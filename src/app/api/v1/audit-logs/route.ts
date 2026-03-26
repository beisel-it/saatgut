import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { listAuditLogs } from "@/lib/server/domain-service";
import { handleApiError } from "@/lib/server/http";
import { serializeAuditLog } from "@/lib/server/serializers";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const logs = await listAuditLogs(auth);
    return NextResponse.json({ items: logs.map(serializeAuditLog) });
  } catch (error) {
    return handleApiError(error);
  }
}
