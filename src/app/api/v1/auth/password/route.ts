import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { changePassword } from "@/lib/server/admin-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serializers";
import { passwordChangeSchema } from "@/lib/server/schemas";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = passwordChangeSchema.parse(await readJson(request));
    const user = await changePassword(auth, payload);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
