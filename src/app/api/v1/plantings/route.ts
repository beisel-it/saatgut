import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { createPlantingEvent, listPlantingEvents } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializePlantingEvent } from "@/lib/server/serializers";
import { plantingEventCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const events = await listPlantingEvents(auth);
    return NextResponse.json({ items: events.map(serializePlantingEvent) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = plantingEventCreateSchema.parse(await readJson(request));
    const event = await createPlantingEvent(auth, payload);
    return NextResponse.json(serializePlantingEvent(event), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
