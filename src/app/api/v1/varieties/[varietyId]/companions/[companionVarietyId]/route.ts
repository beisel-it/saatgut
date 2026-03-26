import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteVarietyCompanion } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ varietyId: string; companionVarietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { varietyId, companionVarietyId } = await params;
    await deleteVarietyCompanion(auth, varietyId, companionVarietyId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
