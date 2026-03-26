import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import {
  PASSKEY_AUTHENTICATION_COOKIE_NAME,
  verifyPasskeyAuthenticationCeremonyToken,
} from "@/lib/auth/passkey-ceremony";
import { applySessionCookie } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { completePasskeyAuthentication } from "@/lib/server/passkey-service";
import { serializeMembership, serializeUser } from "@/lib/server/serializers";
import { passkeyResponseSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const ceremonyCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${PASSKEY_AUTHENTICATION_COOKIE_NAME}=`));

    const ceremonyToken = ceremonyCookie?.slice(`${PASSKEY_AUTHENTICATION_COOKIE_NAME}=`.length);
    const ceremony = ceremonyToken ? verifyPasskeyAuthenticationCeremonyToken(ceremonyToken) : null;

    if (!ceremony) {
      throw new Error("PASSKEY_CEREMONY_MISSING");
    }

    const payload = passkeyResponseSchema.parse(await readJson(request));
    const result = await completePasskeyAuthentication(
      ceremony,
      payload.response as AuthenticationResponseJSON,
    );
    const response = NextResponse.json({
      user: serializeUser(result.user),
      membership: serializeMembership(result.membership),
    });

    applySessionCookie(response, result.sessionToken);
    response.cookies.set({
      name: PASSKEY_AUTHENTICATION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
