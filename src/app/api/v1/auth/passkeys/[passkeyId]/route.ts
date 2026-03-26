import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { removePasskeyCredential } from "@/lib/server/passkey-service";

type RouteContext = {
  params: Promise<{
    passkeyId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { passkeyId } = await context.params;
    const passkey = await removePasskeyCredential(auth, passkeyId);
    return NextResponse.json({ passkey });
  } catch (error) {
    return handleApiError(error);
  }
}
