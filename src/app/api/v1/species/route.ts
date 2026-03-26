import { NextResponse } from "next/server";

import { createSpecies, listSpecies } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSpecies } from "@/lib/server/serializers";
import { speciesCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const species = await listSpecies(auth);
    return NextResponse.json({ items: species.map(serializeSpecies) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = speciesCreateSchema.parse(await readJson(request));
    const species = await createSpecies(auth, payload);
    return NextResponse.json(serializeSpecies(species), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
