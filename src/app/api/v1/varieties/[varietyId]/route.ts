import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteVariety, updateVariety } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeVariety } from "@/lib/server/serializers";
import { varietyUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = varietyUpdateSchema.parse(await readJson(request));
    const { varietyId } = await params;
    const variety = await updateVariety(auth, varietyId, payload);
    return NextResponse.json(serializeVariety(variety));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { varietyId } = await params;
    await deleteVariety(auth, varietyId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
