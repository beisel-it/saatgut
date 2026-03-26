import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { updateReminderTaskStatus } from "@/lib/server/operations-service";
import { serializeReminderTask } from "@/lib/server/serializers";
import { reminderTaskStatusUpdateSchema } from "@/lib/server/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.WRITE });
    const payload = reminderTaskStatusUpdateSchema.parse(await readJson(request));
    const { taskId } = await params;
    const task = await updateReminderTaskStatus(auth, taskId, payload.status);
    return NextResponse.json(serializeReminderTask(task));
  } catch (error) {
    return handleApiError(error);
  }
}
