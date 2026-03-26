import { NextResponse } from "next/server";

import {
  PASSKEY_AUTHENTICATION_COOKIE_NAME,
  createPasskeyAuthenticationCeremonyToken,
} from "@/lib/auth/passkey-ceremony";
import { handleApiError } from "@/lib/server/http";
import { beginPasskeyAuthentication } from "@/lib/server/passkey-service";
import { assertAnonymousRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    assertAnonymousRateLimit(request, "passkey-login-options", 30);
    const result = await beginPasskeyAuthentication();
    const response = NextResponse.json({ options: result.options });

    response.cookies.set({
      name: PASSKEY_AUTHENTICATION_COOKIE_NAME,
      value: createPasskeyAuthenticationCeremonyToken(result.ceremony),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
