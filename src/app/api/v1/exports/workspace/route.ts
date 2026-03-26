import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { exportWorkspaceData } from "@/lib/server/operations-service";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.EXPORT });
    const bundle = await exportWorkspaceData(auth);

    return NextResponse.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename=\"workspace-export-${auth.workspaceId}.json\"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
