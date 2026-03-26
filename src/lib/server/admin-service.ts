import { MembershipRole } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";
import {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
  listWorkspaceCollaborators,
} from "@/lib/server/workspace-collaboration-service";

function requireAdmin(auth: AuthContext) {
  if (auth.role !== "ADMIN" && auth.membershipRole !== MembershipRole.OWNER) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Admin or owner access is required.");
  }
}

export async function listAdminUsers(auth: AuthContext) {
  return listWorkspaceCollaborators(auth);
}

export async function createUserInvite(
  auth: AuthContext,
  input: { email: string; role: MembershipRole; expiresInDays: number },
) {
  return createWorkspaceInvite(auth, input);
}

export async function acceptUserInvite(
  input: { token: string; password?: string },
  options: { authenticatedUserId?: string | null } = {},
) {
  return acceptWorkspaceInvite(input, options);
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

  if (!user?.passwordHash || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
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
