import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { getSessionSnapshot } from "@/lib/server/auth-service";
import { clearSessionCookie, requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { serializeMembership, serializeUser } from "@/lib/server/serializers";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const result = await getSessionSnapshot(auth);

    return NextResponse.json({
      user: serializeUser(result.user),
      membership: serializeMembership(result.membership),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
