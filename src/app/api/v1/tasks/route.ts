import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { createReminderTaskRecord, listReminderTasks } from "@/lib/server/operations-service";
import { serializeReminderTask } from "@/lib/server/serializers";
import { reminderTaskCreateSchema, reminderTaskQuerySchema } from "@/lib/server/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.READ });
    const url = new URL(request.url);
    const query = reminderTaskQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      assignedUserId: url.searchParams.get("assignedUserId") ?? undefined,
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
    });
    const items = await listReminderTasks(auth, query);
    return NextResponse.json({ items: items.map(serializeReminderTask) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = reminderTaskCreateSchema.parse(await readJson(request));
    const task = await createReminderTaskRecord(auth, payload);
    return NextResponse.json(serializeReminderTask(task), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
