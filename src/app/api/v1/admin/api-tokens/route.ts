import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { createWorkspaceApiToken, listApiTokens } from "@/lib/server/operations-service";
import { serializeApiToken } from "@/lib/server/serializers";
import { apiTokenCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const items = await listApiTokens(auth);
    return NextResponse.json({ items: items.map(serializeApiToken) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const payload = apiTokenCreateSchema.parse(await readJson(request));
    const result = await createWorkspaceApiToken(auth, payload);

    return NextResponse.json(
      {
        token: result.token,
        record: serializeApiToken(result.record),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
