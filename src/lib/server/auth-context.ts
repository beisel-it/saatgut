import { NextResponse } from "next/server";

import { MembershipRole, UserRole } from "@prisma/client";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";

export type AuthContext = {
  userId: string;
  workspaceId: string;
  role: UserRole;
  membershipRole: MembershipRole;
};

export async function requireAuth(request: Request): Promise<AuthContext> {
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

  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.user.role,
    membershipRole: membership.role,
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
