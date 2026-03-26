import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { adjustSeedBatchStock, listSeedBatchTransactions } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSeedBatch, serializeSeedBatchTransaction } from "@/lib/server/serializers";
import { seedBatchAdjustmentCreateSchema } from "@/lib/server/schemas";

export async function GET(
  request: Request,
  context: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const { seedBatchId } = await context.params;
    const transactions = await listSeedBatchTransactions(auth, seedBatchId);
    return NextResponse.json({ items: transactions.map(serializeSeedBatchTransaction) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { seedBatchId } = await context.params;
    const payload = seedBatchAdjustmentCreateSchema.parse(await readJson(request));
    const result = await adjustSeedBatchStock(auth, seedBatchId, payload);
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
