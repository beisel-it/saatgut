import { NextResponse } from "next/server";

import { createUserInvite } from "@/lib/server/admin-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeInvite } from "@/lib/server/serializers";
import { adminInviteCreateSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = adminInviteCreateSchema.parse(await readJson(request));
    const result = await createUserInvite(auth, payload);

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
