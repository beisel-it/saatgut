import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { listPasskeyCredentials } from "@/lib/server/passkey-service";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const result = await listPasskeyCredentials(auth);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
