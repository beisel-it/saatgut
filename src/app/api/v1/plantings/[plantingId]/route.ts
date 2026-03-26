import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deletePlantingEvent, updatePlantingEvent } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializePlantingEvent } from "@/lib/server/serializers";
import { plantingEventUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ plantingId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = plantingEventUpdateSchema.parse(await readJson(request));
    const { plantingId } = await params;
    const event = await updatePlantingEvent(auth, plantingId, payload);
    return NextResponse.json(serializePlantingEvent(event));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ plantingId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { plantingId } = await params;
    await deletePlantingEvent(auth, plantingId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
