import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { createVariety, searchVarieties } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeVariety } from "@/lib/server/serializers";
import { catalogQuerySchema, varietyCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const url = new URL(request.url);
    const query = catalogQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      speciesId: url.searchParams.get("speciesId") ?? undefined,
      companionVarietyId: url.searchParams.get("companionVarietyId") ?? undefined,
      heirloom: url.searchParams.get("heirloom") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
    });
    const varieties = await searchVarieties(auth, query);
    return NextResponse.json({ items: varieties.map(serializeVariety) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = varietyCreateSchema.parse(await readJson(request));
    const variety = await createVariety(auth, payload);
    return NextResponse.json(serializeVariety(variety), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
