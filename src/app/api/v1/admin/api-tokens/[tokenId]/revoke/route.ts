import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { revokeWorkspaceApiToken } from "@/lib/server/operations-service";
import { serializeApiToken } from "@/lib/server/serializers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const { tokenId } = await params;
    const record = await revokeWorkspaceApiToken(auth, tokenId);
    return NextResponse.json(serializeApiToken(record));
  } catch (error) {
    return handleApiError(error);
  }
}
