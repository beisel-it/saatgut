import { InviteStatus, MembershipRole } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createInviteToken, hashInviteToken } from "@/lib/auth/invite";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";

function requireAdmin(auth: AuthContext) {
  if (auth.role !== "ADMIN" && auth.membershipRole !== MembershipRole.OWNER) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Admin or owner access is required.");
  }
}

export async function listAdminUsers(auth: AuthContext) {
  requireAdmin(auth);

  const [memberships, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: auth.workspaceId },
      include: { user: true, workspace: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userInvite.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { memberships, invites };
}

export async function createUserInvite(
  auth: AuthContext,
  input: { email: string; role: MembershipRole; expiresInDays: number },
) {
  requireAdmin(auth);
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.$transaction(async (tx) => {
    const existingPending = await tx.userInvite.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        email: input.email.toLowerCase(),
        status: InviteStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ApiError(409, "INVITE_ALREADY_PENDING", "A pending invite already exists for this email.");
    }

    const record = await tx.userInvite.create({
      data: {
        workspaceId: auth.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        invitedByUserId: auth.userId,
        tokenHash,
        expiresAt,
      },
    });

    await writeAuditLog(tx, auth, "userInvite.create", "UserInvite", record.id, {
      email: record.email,
      role: record.role,
    });

    return record;
  });

  return { invite, token };
}

export async function acceptUserInvite(input: { token: string; password: string }) {
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash: hashInviteToken(input.token) },
  });

  if (!invite || invite.status !== InviteStatus.PENDING || invite.expiresAt < new Date()) {
    throw new ApiError(404, "INVITE_NOT_FOUND", "Invite is invalid, expired, or already used.");
  }

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email: invite.email },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          role: "MEMBER",
          isActive: true,
        },
      });
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isActive: true,
        },
      });
    }

    const existingMembership = await tx.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: invite.workspaceId,
        },
      },
    });

    if (!existingMembership) {
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: invite.workspaceId,
          role: invite.role,
        },
      });
    }

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
      "userInvite.accept",
      "UserInvite",
      invite.id,
      { email: invite.email },
    );

    return { user };
  });

  const membership = await prisma.membership.findUniqueOrThrow({
    where: {
      userId_workspaceId: {
        userId: result.user.id,
        workspaceId: invite.workspaceId,
      },
    },
    include: { workspace: true },
  });

  return {
    user: result.user,
    membership,
    sessionToken: createSessionToken({
      userId: result.user.id,
      workspaceId: membership.workspaceId,
      role: result.user.role,
      membershipRole: membership.role,
    }),
  };
}

export async function deactivateWorkspaceUser(auth: AuthContext, targetUserId: string) {
  requireAdmin(auth);

  if (auth.userId === targetUserId) {
    throw new ApiError(409, "SELF_DEACTIVATION_BLOCKED", "You cannot deactivate your own account.");
  }

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: auth.workspaceId,
        },
      },
      include: { user: true },
    });

    if (!membership) {
      throw new ApiError(404, "USER_NOT_FOUND", "User membership was not found in this workspace.");
    }

    const user = await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    await writeAuditLog(tx, auth, "user.deactivate", "User", user.id, {
      email: user.email,
    });

    return user;
  });
}

export async function changePassword(
  auth: AuthContext,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  });

  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
  }

  const passwordHash = await hashPassword(input.newPassword);

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: auth.userId },
      data: { passwordHash },
    });

    await writeAuditLog(tx, auth, "user.passwordChange", "User", updatedUser.id);

    return updatedUser;
  });
}
