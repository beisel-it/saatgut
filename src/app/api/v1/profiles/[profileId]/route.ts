import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteGrowingProfile, updateGrowingProfile } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeGrowingProfile } from "@/lib/server/serializers";
import { growingProfileUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = growingProfileUpdateSchema.parse(await readJson(request));
    const { profileId } = await params;
    const profile = await updateGrowingProfile(auth, profileId, payload);
    return NextResponse.json(serializeGrowingProfile(profile));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { profileId } = await params;
    await deleteGrowingProfile(auth, profileId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
