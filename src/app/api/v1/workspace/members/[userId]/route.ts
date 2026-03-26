import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError, readJson } from "@/lib/server/http";
import { serializeWorkspaceMember } from "@/lib/server/serializers";
import { workspaceMemberRoleUpdateSchema } from "@/lib/server/schemas";
import {
  removeWorkspaceCollaborator,
  updateWorkspaceMemberRole,
} from "@/lib/server/workspace-collaboration-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const { userId } = await params;
    const payload = workspaceMemberRoleUpdateSchema.parse(await readJson(request));
    const membership = await updateWorkspaceMemberRole(auth, userId, payload.role);
    return NextResponse.json({ member: serializeWorkspaceMember(membership) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const { userId } = await params;
    const membership = await removeWorkspaceCollaborator(auth, userId);
    return NextResponse.json({ member: serializeWorkspaceMember(membership) });
  } catch (error) {
    return handleApiError(error);
  }
}
