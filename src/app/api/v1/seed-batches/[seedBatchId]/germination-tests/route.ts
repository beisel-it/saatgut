import { NextResponse } from "next/server";

import { createGerminationTest, listGerminationTests } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeGerminationTest } from "@/lib/server/serializers";
import { germinationTestCreateSchema } from "@/lib/server/schemas";

export async function GET(
  request: Request,
  context: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { seedBatchId } = await context.params;
    const tests = await listGerminationTests(auth, seedBatchId);
    return NextResponse.json({ items: tests.map(serializeGerminationTest) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { seedBatchId } = await context.params;
    const payload = germinationTestCreateSchema.parse(await readJson(request));
    const test = await createGerminationTest(auth, seedBatchId, payload);
    return NextResponse.json(serializeGerminationTest(test), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
