import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { getMediaAssetContent } from "@/lib/server/media-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const { mediaId } = await params;
    const result = await getMediaAssetContent(auth, mediaId);

    return new NextResponse(result.content, {
      headers: {
        "Content-Type": result.asset.mimeType,
        "Content-Length": result.asset.byteSize.toString(),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${result.asset.originalFilename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
