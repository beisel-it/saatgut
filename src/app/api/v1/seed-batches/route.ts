import { NextResponse } from "next/server";

import { createSeedBatch, listSeedBatches } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSeedBatch } from "@/lib/server/serializers";
import { seedBatchCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const seedBatches = await listSeedBatches(auth);
    return NextResponse.json({ items: seedBatches.map(serializeSeedBatch) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = seedBatchCreateSchema.parse(await readJson(request));
    const seedBatch = await createSeedBatch(auth, payload);
    return NextResponse.json(serializeSeedBatch(seedBatch), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
