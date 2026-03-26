import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { reverseSeedBatchTransaction } from "@/lib/server/domain-service";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSeedBatch, serializeSeedBatchTransaction } from "@/lib/server/serializers";
import { seedBatchReversalCreateSchema } from "@/lib/server/schemas";

export async function POST(
  request: Request,
  context: { params: Promise<{ seedBatchId: string; transactionId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { seedBatchId, transactionId } = await context.params;
    const payload = seedBatchReversalCreateSchema.parse(await readJson(request));
    const result = await reverseSeedBatchTransaction(auth, seedBatchId, transactionId, payload);
    return NextResponse.json(
      {
        seedBatch: serializeSeedBatch(result.seedBatch),
        transaction: serializeSeedBatchTransaction(result.transaction),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
