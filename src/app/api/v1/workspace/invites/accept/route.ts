import { NextResponse } from "next/server";

import { applySessionCookie, getOptionalSessionAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { assertAnonymousRateLimit } from "@/lib/server/rate-limit";
import { serializeMembership, serializeUser } from "@/lib/server/serializers";
import { inviteAcceptSchema } from "@/lib/server/schemas";
import { acceptWorkspaceInvite } from "@/lib/server/workspace-collaboration-service";

export async function POST(request: Request) {
  try {
    const currentSession = await getOptionalSessionAuth(request);

    if (!currentSession) {
      assertAnonymousRateLimit(request, "invite-accept", 20);
    }

    const payload = inviteAcceptSchema.parse(await readJson(request));
    const result = await acceptWorkspaceInvite(payload, {
      authenticatedUserId: currentSession?.userId,
    });
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
