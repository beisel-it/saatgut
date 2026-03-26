import { MembershipRole, UserRole, WorkspaceVisibility } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";

function defaultWorkspaceName(email: string): string {
  const localPart = email.split("@")[0] ?? "Saatgut";
  return `${localPart}'s Garden`;
}

export async function registerUser(input: {
  email: string;
  password: string;
  workspaceName?: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new ApiError(409, "EMAIL_IN_USE", "A user with that email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: input.workspaceName?.trim() || defaultWorkspaceName(input.email),
        visibility: WorkspaceVisibility.PRIVATE,
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: MembershipRole.OWNER,
      },
      include: {
        workspace: true,
      },
    });

    await writeAuditLog(tx, { userId: user.id, workspaceId: workspace.id }, "auth.register", "User", user.id, {
      email: user.email,
    });

    return { user, membership };
  });

  const sessionToken = createSessionToken({
    userId: result.user.id,
    workspaceId: result.membership.workspaceId,
    role: result.user.role,
    membershipRole: result.membership.role,
  });

  return {
    sessionToken,
    user: result.user,
    membership: result.membership,
  };
}

export async function loginUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: {
      memberships: {
        include: {
          workspace: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const membership = user.memberships[0];

  if (!membership) {
    throw new ApiError(403, "NO_WORKSPACE", "No workspace membership was found for this user.");
  }

  const sessionToken = createSessionToken({
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: user.role,
    membershipRole: membership.role,
  });

  return {
    sessionToken,
    user,
    membership,
  };
}

export async function getSessionSnapshot(input: {
  userId: string;
  workspaceId: string;
}) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    },
    include: {
      user: true,
      workspace: true,
    },
  });

  if (!membership) {
    throw new ApiError(403, "WORKSPACE_ACCESS_DENIED", "Workspace access was not found.");
  }

  return {
    user: membership.user,
    membership,
  };
}
