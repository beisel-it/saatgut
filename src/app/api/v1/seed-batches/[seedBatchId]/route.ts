import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteSeedBatch, updateSeedBatch } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSeedBatch } from "@/lib/server/serializers";
import { seedBatchUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = seedBatchUpdateSchema.parse(await readJson(request));
    const { seedBatchId } = await params;
    const seedBatch = await updateSeedBatch(auth, seedBatchId, payload);
    return NextResponse.json(serializeSeedBatch(seedBatch));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { seedBatchId } = await params;
    await deleteSeedBatch(auth, seedBatchId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
