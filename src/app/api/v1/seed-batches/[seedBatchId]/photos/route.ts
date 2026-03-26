import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { addSeedBatchPhoto, listSeedBatchPhotos, serializeMediaCollection } from "@/lib/server/media-service";
import { serializeMediaAsset } from "@/lib/server/serializers";
import { seedBatchPhotoMetadataSchema } from "@/lib/server/schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const { seedBatchId } = await params;
    const items = await listSeedBatchPhotos(auth, seedBatchId);
    return NextResponse.json(serializeMediaCollection(items));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ seedBatchId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("MEDIA_FILE_MISSING");
    }

    const payload = seedBatchPhotoMetadataSchema.parse({
      kind: formData.get("kind") ?? undefined,
      altText: formData.get("altText") ?? undefined,
      caption: formData.get("caption") ?? undefined,
    });

    const { seedBatchId } = await params;
    const asset = await addSeedBatchPhoto(auth, seedBatchId, { file, ...payload });
    return NextResponse.json({ photo: serializeMediaAsset(asset) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
