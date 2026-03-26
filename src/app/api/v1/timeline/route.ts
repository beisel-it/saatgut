import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { listTimelineItems } from "@/lib/server/operations-service";
import { timelineQuerySchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const url = new URL(request.url);
    const query = timelineQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const items = await listTimelineItems(auth, query);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
