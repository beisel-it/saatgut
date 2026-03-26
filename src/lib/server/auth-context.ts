import { NextResponse } from "next/server";

import { ApiTokenScope, MembershipRole, UserRole } from "@prisma/client";

import { hashApiToken } from "@/lib/auth/api-token";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { assertRateLimit, getRateLimitKey } from "@/lib/server/rate-limit";

export type AuthContext = {
  userId: string;
  workspaceId: string;
  role: UserRole;
  membershipRole: MembershipRole;
  authMethod: "session" | "api_token";
  tokenScopes?: ApiTokenScope[];
};

function hasScope(scopes: ApiTokenScope[], required: ApiTokenScope) {
  if (scopes.includes(ApiTokenScope.ADMIN)) {
    return true;
  }

  if (required === ApiTokenScope.READ) {
    return (
      scopes.includes(ApiTokenScope.READ) ||
      scopes.includes(ApiTokenScope.WRITE) ||
      scopes.includes(ApiTokenScope.EXPORT)
    );
  }

  if (required === ApiTokenScope.WRITE) {
    return scopes.includes(ApiTokenScope.WRITE);
  }

  return scopes.includes(required);
}

export async function requireAuth(
  request: Request,
  options: { scope?: ApiTokenScope } = {},
): Promise<AuthContext> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice("Bearer ".length).trim();
    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash: hashApiToken(token) },
      include: {
        createdByUser: true,
      },
    });

    if (!apiToken || apiToken.revokedAt || (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
      throw new ApiError(401, "INVALID_API_TOKEN", "API token is invalid, expired, or revoked.");
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: apiToken.createdByUserId,
          workspaceId: apiToken.workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ApiError(403, "WORKSPACE_ACCESS_DENIED", "Workspace access was not found.");
    }

    if (!apiToken.createdByUser.isActive) {
      throw new ApiError(403, "USER_DEACTIVATED", "This user account has been deactivated.");
    }

    if (options.scope && !hasScope(apiToken.scopes, options.scope)) {
      throw new ApiError(403, "API_TOKEN_SCOPE_DENIED", "API token does not grant this capability.", {
        requiredScope: options.scope,
      });
    }

    assertRateLimit({
      key: getRateLimitKey(request, `token:${apiToken.id}`),
      limit: apiToken.rateLimitPerMinute,
    });

    void prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: membership.userId,
      workspaceId: membership.workspaceId,
      role: apiToken.createdByUser.role,
      membershipRole: membership.role,
      authMethod: "api_token",
      tokenScopes: apiToken.scopes,
    };
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!sessionCookie) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const token = sessionCookie.slice(`${SESSION_COOKIE_NAME}=`.length);
  const payload = verifySessionToken(token);

  if (!payload) {
    throw new ApiError(401, "INVALID_SESSION", "Session is invalid or expired.");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
      },
    },
    include: {
      user: true,
    },
  });

  if (!membership) {
    throw new ApiError(403, "WORKSPACE_ACCESS_DENIED", "Workspace access was not found.");
  }

  if (!membership.user.isActive) {
    throw new ApiError(403, "USER_DEACTIVATED", "This user account has been deactivated.");
  }

  assertRateLimit({
    key: getRateLimitKey(request, `user:${membership.userId}`),
  });

  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.user.role,
    membershipRole: membership.role,
    authMethod: "session",
  };
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}
