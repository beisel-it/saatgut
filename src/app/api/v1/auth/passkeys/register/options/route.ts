import { NextResponse } from "next/server";

import {
  PASSKEY_REGISTRATION_COOKIE_NAME,
  createPasskeyRegistrationCeremonyToken,
} from "@/lib/auth/passkey-ceremony";
import { handleApiError, readJson } from "@/lib/server/http";
import { beginPasskeySignup } from "@/lib/server/passkey-service";
import { assertAnonymousRateLimit } from "@/lib/server/rate-limit";
import { passkeySignupStartSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    assertAnonymousRateLimit(request, "passkey-register-options", 20);
    const payload = passkeySignupStartSchema.parse(await readJson(request));
    const result = await beginPasskeySignup(payload);
    const response = NextResponse.json({ options: result.options });

    response.cookies.set({
      name: PASSKEY_REGISTRATION_COOKIE_NAME,
      value: createPasskeyRegistrationCeremonyToken(result.ceremony),
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
