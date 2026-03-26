import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { updateProfilePhenology } from "@/lib/server/domain-service";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeGrowingProfile } from "@/lib/server/serializers";
import { phenologyUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    const { profileId } = await context.params;
    const payload = phenologyUpdateSchema.parse(await readJson(request));
    const profile = await updateProfilePhenology(auth, profileId, payload);
    return NextResponse.json(serializeGrowingProfile(profile));
  } catch (error) {
    return handleApiError(error);
  }
}
