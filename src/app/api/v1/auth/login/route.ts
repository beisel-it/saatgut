import { NextResponse } from "next/server";

import { loginUser } from "@/lib/server/auth-service";
import { applySessionCookie } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeMembership, serializeUser } from "@/lib/server/serializers";
import { loginSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await readJson(request));
    const result = await loginUser(payload);
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
