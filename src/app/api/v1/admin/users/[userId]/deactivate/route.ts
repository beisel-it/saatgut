import { NextResponse } from "next/server";

import { deactivateWorkspaceUser } from "@/lib/server/admin-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { serializeUser } from "@/lib/server/serializers";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { userId } = await context.params;
    const user = await deactivateWorkspaceUser(auth, userId);

    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
