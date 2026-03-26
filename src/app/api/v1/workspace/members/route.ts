import { ApiTokenScope } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { serializeInvite, serializeWorkspaceMember } from "@/lib/server/serializers";
import { listWorkspaceCollaborators } from "@/lib/server/workspace-collaboration-service";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request, { scope: ApiTokenScope.ADMIN });
    const result = await listWorkspaceCollaborators(auth);

    return NextResponse.json({
      items: result.memberships.map(serializeWorkspaceMember),
      invites: result.invites.map(serializeInvite),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
