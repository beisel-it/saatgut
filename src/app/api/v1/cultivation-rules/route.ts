import { NextResponse } from "next/server";

import { listCultivationRules, upsertCultivationRule } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeCultivationRule } from "@/lib/server/serializers";
import { cultivationRuleUpsertSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const rules = await listCultivationRules(auth);
    return NextResponse.json({
      items: rules.map((rule) => ({
        ...serializeCultivationRule(rule),
        variety: {
          id: rule.variety.id,
          name: rule.variety.name,
        },
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = cultivationRuleUpsertSchema.parse(await readJson(request));
    const rule = await upsertCultivationRule(auth, payload);
    return NextResponse.json(serializeCultivationRule(rule), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
