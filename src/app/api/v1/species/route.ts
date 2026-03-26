import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { createSpecies, listSpecies } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSpecies } from "@/lib/server/serializers";
import { catalogQuerySchema, speciesCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const url = new URL(request.url);
    const query = catalogQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    });
    const species = await listSpecies(auth, { q: query.q, category: query.category });
    return NextResponse.json({ items: species.map(serializeSpecies) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = speciesCreateSchema.parse(await readJson(request));
    const species = await createSpecies(auth, payload);
    return NextResponse.json(serializeSpecies(species), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
