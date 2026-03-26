import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteSpecies, updateSpecies } from "@/lib/server/domain-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeSpecies } from "@/lib/server/serializers";
import { speciesUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ speciesId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = speciesUpdateSchema.parse(await readJson(request));
    const { speciesId } = await params;
    const species = await updateSpecies(auth, speciesId, payload);
    return NextResponse.json(serializeSpecies(species));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ speciesId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { speciesId } = await params;
    await deleteSpecies(auth, speciesId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
