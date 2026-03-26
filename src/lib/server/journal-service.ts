import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";

async function assertWorkspaceReferences(
  workspaceId: string,
  ids: { varietyId?: string | null; seedBatchId?: string | null; plantingEventId?: string | null },
) {
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

export async function listJournalEntries(
  auth: AuthContext,
  filters: {
    q?: string;
    varietyId?: string;
    seedBatchId?: string;
    entryType?: Prisma.PlantingJournalEntryWhereInput["entryType"];
    tag?: string;
  },
) {
  return prisma.plantingJournalEntry.findMany({
    where: {
      workspaceId: auth.workspaceId,
      varietyId: filters.varietyId,
      seedBatchId: filters.seedBatchId,
      entryType: filters.entryType,
      tags: filters.tag ? { has: filters.tag } : undefined,
      OR: filters.q
        ? [
            { title: { contains: filters.q, mode: "insensitive" } },
            { details: { contains: filters.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createJournalEntry(
  auth: AuthContext,
  input: {
    varietyId?: string | null;
    seedBatchId?: string | null;
    plantingEventId?: string | null;
    entryType: Prisma.PlantingJournalEntryCreateInput["entryType"];
    title: string;
    details?: string | null;
    entryDate: string;
    quantity?: number | null;
    unit?: Prisma.PlantingJournalEntryCreateInput["unit"];
    tags: string[];
  },
) {
  await assertWorkspaceReferences(auth.workspaceId, input);

  return prisma.$transaction(async (tx) => {
    const entry = await tx.plantingJournalEntry.create({
      data: {
        workspaceId: auth.workspaceId,
        varietyId: input.varietyId ?? null,
        seedBatchId: input.seedBatchId ?? null,
        plantingEventId: input.plantingEventId ?? null,
        entryType: input.entryType,
        title: input.title,
        details: input.details ?? null,
        entryDate: new Date(input.entryDate),
        quantity: input.quantity ? new Prisma.Decimal(input.quantity) : null,
        unit: input.unit ?? null,
        tags: input.tags,
      },
    });

    await writeAuditLog(tx, auth, "journalEntry.create", "PlantingJournalEntry", entry.id, {
      entryType: entry.entryType,
      tags: entry.tags,
    });

    return entry;
  });
}
