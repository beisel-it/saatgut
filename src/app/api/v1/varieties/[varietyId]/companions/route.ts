import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { createVarietyCompanion, listVarietyCompanions } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeVariety } from "@/lib/server/serializers";
import { varietyCompanionCreateSchema } from "@/lib/server/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const { varietyId } = await params;
    const variety = await listVarietyCompanions(auth, varietyId);
    return NextResponse.json({ items: serializeVariety(variety).companionVarieties });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = varietyCompanionCreateSchema.parse(await readJson(request));
    const { varietyId } = await params;
    const variety = await createVarietyCompanion(auth, varietyId, payload.companionVarietyId);
    return NextResponse.json({ items: serializeVariety(variety).companionVarieties }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
