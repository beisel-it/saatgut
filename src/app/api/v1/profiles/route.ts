import { NextResponse } from "next/server";

import { createGrowingProfile, listGrowingProfiles } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeGrowingProfile } from "@/lib/server/serializers";
import { growingProfileCreateSchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const profiles = await listGrowingProfiles(auth);
    return NextResponse.json({ items: profiles.map(serializeGrowingProfile) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const payload = growingProfileCreateSchema.parse(await readJson(request));
    const profile = await createGrowingProfile(auth, payload);
    return NextResponse.json(serializeGrowingProfile(profile), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
