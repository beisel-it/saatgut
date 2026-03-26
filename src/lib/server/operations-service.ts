import { ApiTokenScope, MembershipRole, Prisma, ReminderTaskStatus } from "@prisma/client";

import { createApiToken } from "@/lib/auth/api-token";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";
import {
  serializeApiToken,
  serializeAuditLog,
  serializeCultivationRule,
  serializeGrowingProfile,
  serializeInvite,
  serializeJournalEntry,
  serializePlantingEvent,
  serializeReminderTask,
  serializeSeedBatch,
  serializeSpecies,
  serializeVariety,
} from "@/lib/server/serializers";

function requireWriteAccess(auth: AuthContext) {
  if (auth.membershipRole === MembershipRole.VIEWER) {
    throw new ApiError(403, "WRITE_ACCESS_DENIED", "This workspace membership is read-only.");
  }
}

function requireAdminAccess(auth: AuthContext) {
  if (auth.role !== "ADMIN" && auth.membershipRole !== MembershipRole.OWNER) {
    throw new ApiError(403, "ADMIN_REQUIRED", "Admin or owner access is required.");
  }
}

async function assertOptionalWorkspaceReferences(
  workspaceId: string,
  ids: {
    assignedUserId?: string | null;
    varietyId?: string | null;
    seedBatchId?: string | null;
    plantingEventId?: string | null;
  },
) {
  if (ids.assignedUserId) {
    const membership = await prisma.membership.findFirst({
      where: { workspaceId, userId: ids.assignedUserId },
    });

    if (!membership) {
      throw new ApiError(404, "ASSIGNED_USER_NOT_FOUND", "Assigned user is not part of this workspace.");
    }
  }

  if (ids.varietyId) {
    const variety = await prisma.variety.findFirst({ where: { id: ids.varietyId, workspaceId } });
    if (!variety) {
      throw new ApiError(404, "VARIETY_NOT_FOUND", "Variety was not found in this workspace.");
    }
  }

  if (ids.seedBatchId) {
    const seedBatch = await prisma.seedBatch.findFirst({ where: { id: ids.seedBatchId, workspaceId } });
    if (!seedBatch) {
      throw new ApiError(404, "SEED_BATCH_NOT_FOUND", "Seed batch was not found in this workspace.");
    }
  }

  if (ids.plantingEventId) {
    const event = await prisma.plantingEvent.findFirst({ where: { id: ids.plantingEventId, workspaceId } });
    if (!event) {
      throw new ApiError(404, "PLANTING_EVENT_NOT_FOUND", "Planting event was not found in this workspace.");
    }
  }
}

export async function listReminderTasks(
  auth: AuthContext,
  filters: {
    status?: ReminderTaskStatus;
    assignedUserId?: string;
    dueFrom?: string;
    dueTo?: string;
    tag?: string;
  },
) {
  return prisma.reminderTask.findMany({
    where: {
      workspaceId: auth.workspaceId,
      status: filters.status,
      assignedUserId: filters.assignedUserId,
      dueDate: {
        gte: filters.dueFrom ? new Date(filters.dueFrom) : undefined,
        lte: filters.dueTo ? new Date(filters.dueTo) : undefined,
      },
      tags: filters.tag ? { has: filters.tag } : undefined,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function createReminderTaskRecord(
  auth: AuthContext,
  input: {
    assignedUserId?: string | null;
    varietyId?: string | null;
    seedBatchId?: string | null;
    plantingEventId?: string | null;
    title: string;
    details?: string | null;
    dueDate: string;
    source: Prisma.ReminderTaskCreateInput["source"];
    tags: string[];
  },
) {
  requireWriteAccess(auth);
  await assertOptionalWorkspaceReferences(auth.workspaceId, input);

  return prisma.$transaction(async (tx) => {
    const task = await tx.reminderTask.create({
      data: {
        workspaceId: auth.workspaceId,
        createdByUserId: auth.userId,
        assignedUserId: input.assignedUserId ?? null,
        varietyId: input.varietyId ?? null,
        seedBatchId: input.seedBatchId ?? null,
        plantingEventId: input.plantingEventId ?? null,
        title: input.title,
        details: input.details ?? null,
        dueDate: new Date(input.dueDate),
        source: input.source,
        tags: input.tags,
      },
    });

    await writeAuditLog(tx, auth, "reminderTask.create", "ReminderTask", task.id, {
      source: task.source,
      dueDate: task.dueDate.toISOString(),
    });

    return task;
  });
}

export async function updateReminderTaskStatus(
  auth: AuthContext,
  taskId: string,
  status: ReminderTaskStatus,
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.reminderTask.findFirst({
      where: { id: taskId, workspaceId: auth.workspaceId },
    });

    if (!existing) {
      throw new ApiError(404, "REMINDER_TASK_NOT_FOUND", "Reminder task was not found in this workspace.");
    }

    const updated = await tx.reminderTask.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === ReminderTaskStatus.COMPLETED ? new Date() : null,
        dismissedAt: status === ReminderTaskStatus.DISMISSED ? new Date() : null,
      },
    });

    await writeAuditLog(tx, auth, "reminderTask.updateStatus", "ReminderTask", updated.id, {
      status: updated.status,
    });

    return updated;
  });
}

export function buildTimelineItems(input: {
  journalEntries: ReturnType<typeof serializeJournalEntry>[];
  plantingEvents: ReturnType<typeof serializePlantingEvent>[];
  reminderTasks: ReturnType<typeof serializeReminderTask>[];
}) {
  return [
    ...input.journalEntries.map((entry) => ({
      kind: "journal" as const,
      date: entry.entryDate,
      entry,
    })),
    ...input.plantingEvents.map((event) => ({
      kind: "planting" as const,
      date: event.actualDate ?? event.plannedDate ?? event.createdAt,
      event,
    })),
    ...input.reminderTasks.map((task) => ({
      kind: "task" as const,
      date: task.dueDate,
      task,
    })),
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export async function listTimelineItems(
  auth: AuthContext,
  filters: { limit: number; from?: string; to?: string },
) {
  const dateFilter = {
    gte: filters.from ? new Date(filters.from) : undefined,
    lte: filters.to ? new Date(filters.to) : undefined,
  };

  const [journalEntries, plantingEvents, reminderTasks] = await Promise.all([
    prisma.plantingJournalEntry.findMany({
      where: {
        workspaceId: auth.workspaceId,
        entryDate: dateFilter,
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
    }),
    prisma.plantingEvent.findMany({
      where: {
        workspaceId: auth.workspaceId,
        OR: [
          { actualDate: dateFilter },
          { plannedDate: dateFilter },
        ],
      },
      orderBy: [{ actualDate: "desc" }, { plannedDate: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
    }),
    prisma.reminderTask.findMany({
      where: {
        workspaceId: auth.workspaceId,
        dueDate: dateFilter,
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      take: filters.limit,
    }),
  ]);

  return buildTimelineItems({
    journalEntries: journalEntries.map(serializeJournalEntry),
    plantingEvents: plantingEvents.map(serializePlantingEvent),
    reminderTasks: reminderTasks.map(serializeReminderTask),
  }).slice(0, filters.limit);
}

export async function exportWorkspaceData(auth: AuthContext) {
  requireAdminAccess(auth);

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
  });

  if (!workspace) {
    throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  }

  const [
    memberships,
    species,
    varieties,
    varietyCompanions,
    seedBatches,
    profiles,
    rules,
    plantings,
    journalEntries,
    reminderTasks,
    auditLogs,
    invites,
    apiTokens,
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: auth.workspaceId },
      include: { user: true, workspace: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.species.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { commonName: "asc" } }),
    prisma.variety.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        species: true,
        synonyms: true,
        cultivationRule: true,
        mediaAssets: {
          where: { kind: "VARIETY_REPRESENTATIVE" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.varietyCompanion.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: [{ primaryVarietyId: "asc" }, { secondaryVarietyId: "asc" }],
    }),
    prisma.seedBatch.findMany({
      where: { workspaceId: auth.workspaceId },
      include: {
        germinationTests: true,
        stockTransactions: true,
        mediaAssets: {
          where: {
            kind: { in: ["SEED_BATCH_PACKET", "SEED_BATCH_REFERENCE"] },
          },
          orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
        },
      },
      orderBy: [{ harvestYear: "desc" }, { createdAt: "desc" }],
    }),
    prisma.growingProfile.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.cultivationRule.findMany({
      where: {
        variety: {
          workspaceId: auth.workspaceId,
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.plantingEvent.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.plantingJournalEntry.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { entryDate: "desc" } }),
    prisma.reminderTask.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { dueDate: "asc" } }),
    prisma.auditLog.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.userInvite.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.apiToken.findMany({ where: { workspaceId: auth.workspaceId }, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    workspace: {
      id: workspace.id,
      name: workspace.name,
      visibility: workspace.visibility,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    },
    counts: {
      users: memberships.length,
      species: species.length,
      varieties: varieties.length,
      varietyCompanions: varietyCompanions.length,
      seedBatches: seedBatches.length,
      profiles: profiles.length,
      rules: rules.length,
      plantings: plantings.length,
      journalEntries: journalEntries.length,
      reminderTasks: reminderTasks.length,
      invites: invites.length,
      apiTokens: apiTokens.length,
    },
    memberships: memberships.map((membership) => ({
      role: membership.role,
      user: {
        id: membership.user.id,
        email: membership.user.email,
        isActive: membership.user.isActive,
        role: membership.user.role,
        createdAt: membership.user.createdAt.toISOString(),
        updatedAt: membership.user.updatedAt.toISOString(),
      },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        visibility: membership.workspace.visibility,
        createdAt: membership.workspace.createdAt.toISOString(),
        updatedAt: membership.workspace.updatedAt.toISOString(),
      },
      createdAt: membership.createdAt.toISOString(),
    })),
    species: species.map(serializeSpecies),
    varieties: varieties.map(serializeVariety),
    varietyCompanions: varietyCompanions.map((link) => ({
      ...link,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    })),
    seedBatches: seedBatches.map(serializeSeedBatch),
    growingProfiles: profiles.map(serializeGrowingProfile),
    cultivationRules: rules.map(serializeCultivationRule),
    plantingEvents: plantings.map(serializePlantingEvent),
    journalEntries: journalEntries.map(serializeJournalEntry),
    reminderTasks: reminderTasks.map(serializeReminderTask),
    invites: invites.map(serializeInvite),
    apiTokens: apiTokens.map(serializeApiToken),
    auditLogs: auditLogs.map(serializeAuditLog),
  };
}

export async function listApiTokens(auth: AuthContext) {
  requireAdminAccess(auth);

  return prisma.apiToken.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWorkspaceApiToken(
  auth: AuthContext,
  input: {
    name: string;
    scopes: ApiTokenScope[];
    expiresInDays?: number | null;
    rateLimitPerMinute?: number | null;
  },
) {
  requireAdminAccess(auth);

  const generated = createApiToken();
  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const token = await prisma.$transaction(async (tx) => {
    const record = await tx.apiToken.create({
      data: {
        workspaceId: auth.workspaceId,
        createdByUserId: auth.userId,
        name: input.name,
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
        scopes: input.scopes,
        rateLimitPerMinute: input.rateLimitPerMinute ?? env.API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE,
        expiresAt,
      },
    });

    await writeAuditLog(tx, auth, "apiToken.create", "ApiToken", record.id, {
      name: record.name,
      scopes: record.scopes,
    });

    return record;
  });

  return {
    token: generated.plainTextToken,
    record: token,
  };
}

export async function revokeWorkspaceApiToken(auth: AuthContext, tokenId: string) {
  requireAdminAccess(auth);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.apiToken.findFirst({
      where: { id: tokenId, workspaceId: auth.workspaceId },
    });

    if (!existing) {
      throw new ApiError(404, "API_TOKEN_NOT_FOUND", "API token was not found in this workspace.");
    }

    const record = await tx.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    await writeAuditLog(tx, auth, "apiToken.revoke", "ApiToken", record.id, {
      name: record.name,
    });

    return record;
  });
}
