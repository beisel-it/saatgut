import { Prisma } from "@prisma/client";

type AuditActor = {
  userId?: string | null;
  workspaceId: string;
};

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  action: string,
  entityType: string,
  entityId: string,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId ?? null,
      action,
      entityType,
      entityId,
      payload,
    },
  });
}
