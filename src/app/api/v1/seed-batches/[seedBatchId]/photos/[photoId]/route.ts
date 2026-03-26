import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { deleteSeedBatchPhoto } from "@/lib/server/media-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ seedBatchId: string; photoId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { seedBatchId, photoId } = await params;
    await deleteSeedBatchPhoto(auth, seedBatchId, photoId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
