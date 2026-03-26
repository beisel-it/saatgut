import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeInvite } from "@/lib/server/serializers";
import { adminInviteCreateSchema } from "@/lib/server/schemas";
import { createWorkspaceInvite } from "@/lib/server/workspace-collaboration-service";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const payload = adminInviteCreateSchema.parse(await readJson(request));
    const result = await createWorkspaceInvite(auth, payload);

    return NextResponse.json(
      {
        invite: serializeInvite(result.invite),
        token: result.token,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
