import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteCultivationRule, updateCultivationRule } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeCultivationRule } from "@/lib/server/serializers";
import { cultivationRuleUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = cultivationRuleUpdateSchema.parse(await readJson(request));
    const { ruleId } = await params;
    const rule = await updateCultivationRule(auth, ruleId, payload);
    return NextResponse.json(serializeCultivationRule(rule));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { ruleId } = await params;
    await deleteCultivationRule(auth, ruleId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
