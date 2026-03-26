import { NextResponse } from "next/server";

import { acceptUserInvite } from "@/lib/server/admin-service";
import { applySessionCookie } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeMembership, serializeUser } from "@/lib/server/serializers";
import { inviteAcceptSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const payload = inviteAcceptSchema.parse(await readJson(request));
    const result = await acceptUserInvite(payload);
    const response = NextResponse.json({
      user: serializeUser(result.user),
      membership: serializeMembership(result.membership),
    });

    applySessionCookie(response, result.sessionToken);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
