import { InviteStatus, MembershipRole } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createInviteToken, hashInviteToken } from "@/lib/auth/invite";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";

function requireMemberManagementAccess(auth: AuthContext) {
  if (auth.role !== "ADMIN" && auth.membershipRole !== MembershipRole.OWNER) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Admin or owner access is required.");
  }
}

export async function listWorkspaceCollaborators(auth: AuthContext) {
  requireMemberManagementAccess(auth);

  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: auth.workspaceId },
      include: { user: true, workspace: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.userInvite.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { memberships, invites };
}

export async function createWorkspaceInvite(
  auth: AuthContext,
  input: { email: string; role: MembershipRole; expiresInDays: number },
) {
  requireMemberManagementAccess(auth);

  if (input.role === MembershipRole.OWNER) {
    throw new ApiError(
      422,
      "OWNER_INVITE_NOT_SUPPORTED",
      "Collaborator invites can only grant member or viewer access.",
    );
  }

  const email = input.email.toLowerCase();
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    const [existingMembership, existingPending] = await Promise.all([
      tx.membership.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          user: { email },
        },
      }),
      tx.userInvite.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          email,
          status: InviteStatus.PENDING,
        },
      }),
    ]);

    if (existingMembership) {
      throw new ApiError(
        409,
        "MEMBERSHIP_ALREADY_EXISTS",
        "That user already has access to this workspace.",
      );
    }

    if (existingPending) {
      throw new ApiError(
        409,
        "INVITE_ALREADY_PENDING",
        "A pending invite already exists for this email.",
      );
    }

    const record = await tx.userInvite.create({
      data: {
        workspaceId: auth.workspaceId,
        email,
        role: input.role,
        invitedByUserId: auth.userId,
        tokenHash,
        expiresAt,
      },
    });

    await writeAuditLog(tx, auth, "workspaceInvite.create", "UserInvite", record.id, {
      email: record.email,
      role: record.role,
    });

    return record;
  });

  return { invite, token };
}

export async function acceptWorkspaceInvite(
  input: { token: string; password?: string },
  options: { authenticatedUserId?: string | null } = {},
) {
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash: hashInviteToken(input.token) },
  });

  if (!invite || invite.status !== InviteStatus.PENDING || invite.expiresAt < new Date()) {
    throw new ApiError(404, "INVITE_NOT_FOUND", "Invite is invalid, expired, or already used.");
  }

  const result = await prisma.$transaction(async (tx) => {
    let user;

    if (options.authenticatedUserId) {
      user = await tx.user.findUnique({
        where: { id: options.authenticatedUserId },
      });

      if (!user) {
        throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
      }

      if (user.email !== invite.email) {
        throw new ApiError(
          403,
          "INVITE_EMAIL_MISMATCH",
          "The signed-in user does not match this invite email.",
        );
      }
    } else {
      user = await tx.user.findUnique({
        where: { email: invite.email },
      });

      if (user) {
        if (!input.password || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        }
      } else {
        if (!input.password) {
          throw new ApiError(
            422,
            "PASSWORD_REQUIRED",
            "A password is required to create a new account from this invite.",
          );
        }

        user = await tx.user.create({
          data: {
            email: invite.email,
            passwordHash: await hashPassword(input.password),
            role: "MEMBER",
            isActive: true,
          },
        });
      }
    }

    if (!user.isActive) {
      throw new ApiError(403, "USER_DEACTIVATED", "This user account has been deactivated.");
    }

    const existingMembership = await tx.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: invite.workspaceId,
        },
      },
    });

    if (existingMembership) {
      throw new ApiError(
        409,
        "MEMBERSHIP_ALREADY_EXISTS",
        "That user already has access to this workspace.",
      );
    }

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: invite.workspaceId,
        role: invite.role,
      },
      include: { workspace: true },
    });

    await tx.userInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await writeAuditLog(
      tx,
      { userId: user.id, workspaceId: invite.workspaceId },
      "workspaceInvite.accept",
      "UserInvite",
      invite.id,
      { email: invite.email, role: invite.role },
    );

    return { user, membership };
  });

  return {
    user: result.user,
    membership: result.membership,
    sessionToken: createSessionToken({
      userId: result.user.id,
      workspaceId: result.membership.workspaceId,
      role: result.user.role,
      membershipRole: result.membership.role,
    }),
  };
}

export async function updateWorkspaceMemberRole(
  auth: AuthContext,
  targetUserId: string,
  role: "MEMBER" | "VIEWER",
) {
  requireMemberManagementAccess(auth);

  if (auth.userId === targetUserId) {
    throw new ApiError(409, "SELF_ROLE_UPDATE_BLOCKED", "You cannot change your own workspace role.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: auth.workspaceId,
        },
      },
      include: {
        user: true,
        workspace: true,
      },
    });

    if (!membership) {
      throw new ApiError(404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new ApiError(
        409,
        "OWNER_ROLE_UPDATE_BLOCKED",
        "Workspace ownership cannot be changed through this contract.",
      );
    }

    const updatedMembership = await tx.membership.update({
      where: { id: membership.id },
      data: { role },
      include: {
        user: true,
        workspace: true,
      },
    });

    await writeAuditLog(tx, auth, "membership.updateRole", "Membership", updatedMembership.id, {
      userId: updatedMembership.userId,
      role: updatedMembership.role,
    });

    return updatedMembership;
  });
}

export async function removeWorkspaceCollaborator(auth: AuthContext, targetUserId: string) {
  requireMemberManagementAccess(auth);

  if (auth.userId === targetUserId) {
    throw new ApiError(409, "SELF_REMOVAL_BLOCKED", "You cannot remove your own workspace access.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: auth.workspaceId,
        },
      },
      include: {
        user: true,
        workspace: true,
      },
    });

    if (!membership) {
      throw new ApiError(404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
    }

    if (membership.role === MembershipRole.OWNER) {
      throw new ApiError(
        409,
        "OWNER_REMOVAL_BLOCKED",
        "Workspace owners cannot be removed through this contract.",
      );
    }

    await tx.membership.delete({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: auth.workspaceId,
        },
      },
    });

    await tx.apiToken.updateMany({
      where: {
        workspaceId: auth.workspaceId,
        createdByUserId: targetUserId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await tx.userInvite.updateMany({
      where: {
        workspaceId: auth.workspaceId,
        email: membership.user.email,
        status: InviteStatus.PENDING,
      },
      data: {
        status: InviteStatus.REVOKED,
      },
    });

    await writeAuditLog(tx, auth, "membership.remove", "Membership", membership.id, {
      userId: membership.userId,
      email: membership.user.email,
    });

    return membership;
  });
}
