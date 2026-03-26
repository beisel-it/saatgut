import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { replaceVarietyRepresentativeImage, deleteVarietyRepresentativeImage } from "@/lib/server/media-service";
import { serializeMediaAsset } from "@/lib/server/serializers";
import { mediaMetadataSchema } from "@/lib/server/schemas";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("MEDIA_FILE_MISSING");
    }

    const payload = mediaMetadataSchema.parse({
      altText: formData.get("altText") ?? undefined,
      caption: formData.get("caption") ?? undefined,
    });

    const { varietyId } = await params;
    const asset = await replaceVarietyRepresentativeImage(auth, varietyId, { file, ...payload });
    return NextResponse.json({ image: serializeMediaAsset(asset) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ varietyId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const { varietyId } = await params;
    await deleteVarietyRepresentativeImage(auth, varietyId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
