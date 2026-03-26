import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  PASSKEY_REGISTRATION_COOKIE_NAME,
  createPasskeyRegistrationCeremonyToken,
} from "@/lib/auth/passkey-ceremony";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { beginPasskeyEnrollment } from "@/lib/server/passkey-service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const result = await beginPasskeyEnrollment(auth);
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
