import { NextResponse } from "next/server";

import { createVariety, listVarieties } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeVariety } from "@/lib/server/serializers";
import { varietyCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const varieties = await listVarieties(auth);
    return NextResponse.json({ items: varieties.map(serializeVariety) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = varietyCreateSchema.parse(await readJson(request));
    const variety = await createVariety(auth, payload);
    return NextResponse.json(serializeVariety(variety), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
