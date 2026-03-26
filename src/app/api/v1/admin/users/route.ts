import { NextResponse } from "next/server";

import { listAdminUsers } from "@/lib/server/admin-service";
import { requireAuth } from "@/lib/server/auth-context";
import { handleApiError } from "@/lib/server/http";
import { serializeInvite, serializeMembership, serializeUser } from "@/lib/server/serializers";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const result = await listAdminUsers(auth);

    return NextResponse.json({
      memberships: result.memberships.map((membership) => ({
        role: membership.role,
        workspace: serializeMembership(membership).workspace,
        user: serializeUser(membership.user),
      })),
      invites: result.invites.map(serializeInvite),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
