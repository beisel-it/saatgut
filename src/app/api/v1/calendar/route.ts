import { NextResponse } from "next/server";

import { getCalendarItems } from "@/lib/server/calendar-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { calendarQuerySchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const url = new URL(request.url);
    const query = calendarQuerySchema.parse({
      days: url.searchParams.get("days") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
    });

    const items = await getCalendarItems({
      workspaceId: auth.workspaceId,
      days: query.days,
      from: query.from ? new Date(query.from) : undefined,
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
