import { MediaAssetKind, MembershipRole, Prisma, PrismaClient, SeedBatchTransactionType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";
import { deleteStoredMedia } from "@/lib/server/media-storage";
import { buildSeedBatchWarnings, calculateGerminationRate } from "@/lib/server/seed-batch-quality";

type DbClient = PrismaClient | Prisma.TransactionClient;

function requireWriteAccess(auth: AuthContext) {
  if (auth.membershipRole === MembershipRole.VIEWER) {
    throw new ApiError(403, "WRITE_ACCESS_DENIED", "This workspace membership is read-only.");
  }
}

async function assertSpeciesInWorkspace(db: DbClient, workspaceId: string, speciesId: string) {
  const species = await db.species.findFirst({
    where: {
      id: speciesId,
      workspaceId,
    },
  });

  if (!species) {
    throw new ApiError(404, "SPECIES_NOT_FOUND", "Species was not found in this workspace.");
  }

  return species;
}

async function assertVarietyInWorkspace(db: DbClient, workspaceId: string, varietyId: string) {
  const variety = await db.variety.findFirst({
    where: {
      id: varietyId,
      workspaceId,
    },
  });

  if (!variety) {
    throw new ApiError(404, "VARIETY_NOT_FOUND", "Variety was not found in this workspace.");
  }

  return variety;
}

async function assertGrowingProfileInWorkspace(db: DbClient, workspaceId: string, profileId: string) {
  const profile = await db.growingProfile.findFirst({
    where: {
      id: profileId,
      workspaceId,
    },
  });

  if (!profile) {
    throw new ApiError(404, "GROWING_PROFILE_NOT_FOUND", "Growing profile was not found in this workspace.");
  }

  return profile;
}

async function assertSeedBatchInWorkspace(db: DbClient, workspaceId: string, seedBatchId: string) {
  const seedBatch = await db.seedBatch.findFirst({
    where: {
      id: seedBatchId,
      workspaceId,
    },
  });

  if (!seedBatch) {
    throw new ApiError(404, "SEED_BATCH_NOT_FOUND", "Seed batch was not found in this workspace.");
  }

  return seedBatch;
}

async function assertPlantingEventInWorkspace(db: DbClient, workspaceId: string, plantingEventId: string) {
  const plantingEvent = await db.plantingEvent.findFirst({
    where: {
      id: plantingEventId,
      workspaceId,
    },
  });

  if (!plantingEvent) {
    throw new ApiError(404, "PLANTING_EVENT_NOT_FOUND", "Planting event was not found in this workspace.");
  }

  return plantingEvent;
}

export async function listSpecies(
  auth: AuthContext,
  filters: { q?: string; category?: Prisma.SpeciesWhereInput["category"] } = {},
) {
  return prisma.species.findMany({
    where: {
      workspaceId: auth.workspaceId,
      category: filters.category,
      OR: filters.q
        ? [
            { commonName: { contains: filters.q, mode: "insensitive" } },
            { latinName: { contains: filters.q, mode: "insensitive" } },
            { germinationNotes: { contains: filters.q, mode: "insensitive" } },
            { preferredLocation: { contains: filters.q, mode: "insensitive" } },
            { companionPlantingNotes: { contains: filters.q, mode: "insensitive" } },
            { notes: { contains: filters.q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { commonName: "asc" },
  });
}

export async function createSpecies(
  auth: AuthContext,
  input: {
    commonName: string;
    latinName?: string | null;
    category: Prisma.SpeciesCreateInput["category"];
    germinationNotes?: string | null;
    preferredLocation?: string | null;
    companionPlantingNotes?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const species = await tx.species.create({
      data: {
        workspaceId: auth.workspaceId,
        commonName: input.commonName,
        latinName: input.latinName ?? null,
        category: input.category,
        germinationNotes: input.germinationNotes ?? null,
        preferredLocation: input.preferredLocation ?? null,
        companionPlantingNotes: input.companionPlantingNotes ?? null,
        notes: input.notes ?? null,
      },
    });

    await writeAuditLog(tx, auth, "species.create", "Species", species.id, {
      commonName: species.commonName,
      category: species.category,
    });

    return species;
  });
}

export async function updateSpecies(
  auth: AuthContext,
  speciesId: string,
  input: {
    commonName?: string;
    latinName?: string | null;
    category?: Prisma.SpeciesUpdateInput["category"];
    germinationNotes?: string | null;
    preferredLocation?: string | null;
    companionPlantingNotes?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertSpeciesInWorkspace(tx, auth.workspaceId, speciesId);

    const species = await tx.species.update({
      where: { id: speciesId },
      data: {
        commonName: input.commonName,
        latinName: input.latinName,
        category: input.category,
        germinationNotes: input.germinationNotes,
        preferredLocation: input.preferredLocation,
        companionPlantingNotes: input.companionPlantingNotes,
        notes: input.notes,
      },
    });

    await writeAuditLog(tx, auth, "species.update", "Species", species.id, {
      fields: Object.keys(input),
    });

    return species;
  });
}

export async function deleteSpecies(auth: AuthContext, speciesId: string) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertSpeciesInWorkspace(tx, auth.workspaceId, speciesId);

    const varietyCount = await tx.variety.count({
      where: {
        workspaceId: auth.workspaceId,
        speciesId,
      },
    });

    if (varietyCount > 0) {
      throw new ApiError(
        409,
        "SPECIES_DELETE_BLOCKED",
        "Species cannot be deleted while varieties still reference it.",
        { varietyCount },
      );
    }

    await tx.species.delete({ where: { id: speciesId } });
    await writeAuditLog(tx, auth, "species.delete", "Species", speciesId, {});
  });
}

export async function listVarieties(auth: AuthContext) {
  return prisma.variety.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      species: true,
      synonyms: true,
      mediaAssets: {
        where: {
          kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
        },
      },
      cultivationRule: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function searchVarieties(
  auth: AuthContext,
  filters: {
    q?: string;
    speciesId?: string;
    category?: Prisma.SpeciesWhereInput["category"];
    heirloom?: boolean;
    tag?: string;
  },
) {
  return prisma.variety.findMany({
    where: {
      workspaceId: auth.workspaceId,
      speciesId: filters.speciesId,
      heirloom: filters.heirloom,
      tags: filters.tag ? { has: filters.tag } : undefined,
      species: {
        category: filters.category,
      },
      OR: filters.q
        ? [
            { name: { contains: filters.q, mode: "insensitive" } },
            { description: { contains: filters.q, mode: "insensitive" } },
            { germinationNotes: { contains: filters.q, mode: "insensitive" } },
            { preferredLocation: { contains: filters.q, mode: "insensitive" } },
            { companionPlantingNotes: { contains: filters.q, mode: "insensitive" } },
            { notes: { contains: filters.q, mode: "insensitive" } },
            { species: { commonName: { contains: filters.q, mode: "insensitive" } } },
            { synonyms: { some: { name: { contains: filters.q, mode: "insensitive" } } } },
          ]
        : undefined,
    },
    include: {
      species: true,
      synonyms: true,
      mediaAssets: {
        where: {
          kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
        },
      },
      cultivationRule: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createVariety(
  auth: AuthContext,
  input: {
    speciesId: string;
    name: string;
    description?: string | null;
    heirloom: boolean;
    tags: string[];
    germinationNotes?: string | null;
    preferredLocation?: string | null;
    companionPlantingNotes?: string | null;
    notes?: string | null;
    synonyms: string[];
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertSpeciesInWorkspace(tx, auth.workspaceId, input.speciesId);

    const variety = await tx.variety.create({
      data: {
        workspaceId: auth.workspaceId,
        speciesId: input.speciesId,
        name: input.name,
        description: input.description ?? null,
        heirloom: input.heirloom,
        tags: input.tags,
        germinationNotes: input.germinationNotes ?? null,
        preferredLocation: input.preferredLocation ?? null,
        companionPlantingNotes: input.companionPlantingNotes ?? null,
        notes: input.notes ?? null,
        synonyms: input.synonyms.length
          ? {
              create: input.synonyms.map((synonym) => ({ name: synonym })),
            }
          : undefined,
      },
      include: {
        species: true,
        synonyms: true,
        mediaAssets: {
          where: {
            kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
          },
        },
        cultivationRule: true,
      },
    });

    await writeAuditLog(tx, auth, "variety.create", "Variety", variety.id, {
      name: variety.name,
      speciesId: variety.speciesId,
    });

    return variety;
  });
}

export async function updateVariety(
  auth: AuthContext,
  varietyId: string,
  input: {
    speciesId?: string;
    name?: string;
    description?: string | null;
    heirloom?: boolean;
    tags?: string[];
    germinationNotes?: string | null;
    preferredLocation?: string | null;
    companionPlantingNotes?: string | null;
    notes?: string | null;
    synonyms?: string[];
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, varietyId);

    if (input.speciesId) {
      await assertSpeciesInWorkspace(tx, auth.workspaceId, input.speciesId);
    }

    const variety = await tx.variety.update({
      where: { id: varietyId },
      data: {
        speciesId: input.speciesId,
        name: input.name,
        description: input.description,
        heirloom: input.heirloom,
        tags: input.tags,
        germinationNotes: input.germinationNotes,
        preferredLocation: input.preferredLocation,
        companionPlantingNotes: input.companionPlantingNotes,
        notes: input.notes,
        synonyms:
          input.synonyms === undefined
            ? undefined
            : {
                deleteMany: {},
                create: input.synonyms.map((synonym) => ({ name: synonym })),
              },
      },
      include: {
        species: true,
        synonyms: true,
        mediaAssets: {
          where: {
            kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
          },
        },
        cultivationRule: true,
      },
    });

    await writeAuditLog(tx, auth, "variety.update", "Variety", variety.id, {
      fields: Object.keys(input),
    });

    return variety;
  });
}

export async function deleteVariety(auth: AuthContext, varietyId: string) {
  requireWriteAccess(auth);

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: {
      workspaceId: auth.workspaceId,
      varietyId,
    },
    select: { storageKey: true },
  });

  await prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, varietyId);

    const [seedBatchCount, plantingEventCount, journalEntryCount, reminderTaskCount] =
      await Promise.all([
        tx.seedBatch.count({ where: { workspaceId: auth.workspaceId, varietyId } }),
        tx.plantingEvent.count({ where: { workspaceId: auth.workspaceId, varietyId } }),
        tx.plantingJournalEntry.count({ where: { workspaceId: auth.workspaceId, varietyId } }),
        tx.reminderTask.count({ where: { workspaceId: auth.workspaceId, varietyId } }),
      ]);

    if (seedBatchCount || plantingEventCount || journalEntryCount || reminderTaskCount) {
      throw new ApiError(
        409,
        "VARIETY_DELETE_BLOCKED",
        "Variety cannot be deleted while it still has catalog or history references.",
        { seedBatchCount, plantingEventCount, journalEntryCount, reminderTaskCount },
      );
    }

    await tx.variety.delete({ where: { id: varietyId } });
    await writeAuditLog(tx, auth, "variety.delete", "Variety", varietyId, {});
  });

  await Promise.all(mediaAssets.map((asset) => deleteStoredMedia(asset.storageKey)));
}

export async function listSeedBatches(auth: AuthContext) {
  const seedBatches = await prisma.seedBatch.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      mediaAssets: {
        where: {
          kind: {
            in: [MediaAssetKind.SEED_BATCH_PACKET, MediaAssetKind.SEED_BATCH_REFERENCE],
          },
        },
        orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      },
      germinationTests: {
        orderBy: { testedAt: "desc" },
      },
      stockTransactions: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ harvestYear: "desc" }, { createdAt: "desc" }],
  });

  return seedBatches.map((seedBatch) => ({
    ...seedBatch,
    storageWarnings: buildSeedBatchWarnings({
      harvestYear: seedBatch.harvestYear,
      storageLocation: seedBatch.storageLocation,
      storageTemperatureC: seedBatch.storageTemperatureC,
      storageHumidityPercent: seedBatch.storageHumidityPercent,
      storageLightExposure: seedBatch.storageLightExposure,
      storageMoistureLevel: seedBatch.storageMoistureLevel,
      latestGerminationRate: seedBatch.germinationTests[0]?.germinationRate ?? null,
      latestGerminationTestedAt: seedBatch.germinationTests[0]?.testedAt ?? null,
    }),
  }));
}

export async function createSeedBatch(
  auth: AuthContext,
  input: {
    varietyId: string;
    source?: string | null;
    harvestYear?: number | null;
    quantity: number;
    unit: Prisma.SeedBatchCreateInput["unit"];
    storageLocation?: string | null;
    storageTemperatureC?: number | null;
    storageHumidityPercent?: number | null;
    storageLightExposure?: Prisma.SeedBatchCreateInput["storageLightExposure"];
    storageMoistureLevel?: Prisma.SeedBatchCreateInput["storageMoistureLevel"];
    storageContainer?: string | null;
    storageQualityCheckedAt?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);

    const seedBatch = await tx.seedBatch.create({
      data: {
        workspaceId: auth.workspaceId,
        varietyId: input.varietyId,
        source: input.source ?? null,
        harvestYear: input.harvestYear ?? null,
        quantity: new Prisma.Decimal(input.quantity),
        unit: input.unit,
        storageLocation: input.storageLocation ?? null,
        storageTemperatureC:
          input.storageTemperatureC === undefined || input.storageTemperatureC === null
            ? null
            : new Prisma.Decimal(input.storageTemperatureC),
        storageHumidityPercent: input.storageHumidityPercent ?? null,
        storageLightExposure: input.storageLightExposure ?? null,
        storageMoistureLevel: input.storageMoistureLevel ?? null,
        storageContainer: input.storageContainer ?? null,
        storageQualityCheckedAt: input.storageQualityCheckedAt
          ? new Date(input.storageQualityCheckedAt)
          : null,
        notes: input.notes ?? null,
      },
      include: {
        mediaAssets: {
          where: {
            kind: {
              in: [MediaAssetKind.SEED_BATCH_PACKET, MediaAssetKind.SEED_BATCH_REFERENCE],
            },
          },
          orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
        },
        germinationTests: true,
        stockTransactions: true,
      },
    });

    await tx.seedBatchTransaction.create({
      data: {
        workspaceId: auth.workspaceId,
        seedBatchId: seedBatch.id,
        type: SeedBatchTransactionType.INITIAL_STOCK,
        quantityDelta: seedBatch.quantity,
        quantityBefore: new Prisma.Decimal(0),
        quantityAfter: seedBatch.quantity,
        effectiveDate: new Date(),
        reason: "Initial stock recorded on batch creation.",
      },
    });

    await writeAuditLog(tx, auth, "seedBatch.create", "SeedBatch", seedBatch.id, {
      varietyId: seedBatch.varietyId,
      quantity: seedBatch.quantity.toString(),
      unit: seedBatch.unit,
    });

    return seedBatch;
  });
}

export async function updateSeedBatch(
  auth: AuthContext,
  seedBatchId: string,
  input: {
    varietyId?: string;
    source?: string | null;
    harvestYear?: number | null;
    storageLocation?: string | null;
    storageTemperatureC?: number | null;
    storageHumidityPercent?: number | null;
    storageLightExposure?: Prisma.SeedBatchUpdateInput["storageLightExposure"];
    storageMoistureLevel?: Prisma.SeedBatchUpdateInput["storageMoistureLevel"];
    storageContainer?: string | null;
    storageQualityCheckedAt?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);

    if (input.varietyId) {
      await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);
    }

    const seedBatch = await tx.seedBatch.update({
      where: { id: seedBatchId },
      data: {
        varietyId: input.varietyId,
        source: input.source,
        harvestYear: input.harvestYear,
        storageLocation: input.storageLocation,
        storageTemperatureC:
          input.storageTemperatureC === undefined
            ? undefined
            : input.storageTemperatureC === null
              ? null
              : new Prisma.Decimal(input.storageTemperatureC),
        storageHumidityPercent: input.storageHumidityPercent,
        storageLightExposure: input.storageLightExposure,
        storageMoistureLevel: input.storageMoistureLevel,
        storageContainer: input.storageContainer,
        storageQualityCheckedAt:
          input.storageQualityCheckedAt === undefined
            ? undefined
            : input.storageQualityCheckedAt === null
              ? null
              : new Date(input.storageQualityCheckedAt),
        notes: input.notes,
      },
      include: {
        mediaAssets: {
          where: {
            kind: {
              in: [MediaAssetKind.SEED_BATCH_PACKET, MediaAssetKind.SEED_BATCH_REFERENCE],
            },
          },
          orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
        },
        germinationTests: { orderBy: { testedAt: "desc" } },
        stockTransactions: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] },
      },
    });

    await writeAuditLog(tx, auth, "seedBatch.update", "SeedBatch", seedBatch.id, {
      fields: Object.keys(input),
    });

    return {
      ...seedBatch,
      storageWarnings: buildSeedBatchWarnings({
        harvestYear: seedBatch.harvestYear,
        storageLocation: seedBatch.storageLocation,
        storageTemperatureC: seedBatch.storageTemperatureC,
        storageHumidityPercent: seedBatch.storageHumidityPercent,
        storageLightExposure: seedBatch.storageLightExposure,
        storageMoistureLevel: seedBatch.storageMoistureLevel,
        latestGerminationRate: seedBatch.germinationTests[0]?.germinationRate ?? null,
        latestGerminationTestedAt: seedBatch.germinationTests[0]?.testedAt ?? null,
      }),
    };
  });
}

export async function deleteSeedBatch(auth: AuthContext, seedBatchId: string) {
  requireWriteAccess(auth);

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: {
      workspaceId: auth.workspaceId,
      seedBatchId,
    },
    select: { storageKey: true },
  });

  await prisma.$transaction(async (tx) => {
    await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);

    const [germinationTestCount, plantingEventCount, journalEntryCount, reminderTaskCount, stockTransactions] =
      await Promise.all([
        tx.germinationTest.count({ where: { workspaceId: auth.workspaceId, seedBatchId } }),
        tx.plantingEvent.count({ where: { workspaceId: auth.workspaceId, seedBatchId } }),
        tx.plantingJournalEntry.count({ where: { workspaceId: auth.workspaceId, seedBatchId } }),
        tx.reminderTask.count({ where: { workspaceId: auth.workspaceId, seedBatchId } }),
        tx.seedBatchTransaction.findMany({
          where: { workspaceId: auth.workspaceId, seedBatchId },
          select: { type: true },
        }),
      ]);

    const nonInitialTransactionCount = stockTransactions.filter(
      (transaction) => transaction.type !== SeedBatchTransactionType.INITIAL_STOCK,
    ).length;

    if (germinationTestCount || plantingEventCount || journalEntryCount || reminderTaskCount || nonInitialTransactionCount) {
      throw new ApiError(
        409,
        "SEED_BATCH_DELETE_BLOCKED",
        "Seed batch cannot be deleted while it still has quality or operational history.",
        {
          germinationTestCount,
          plantingEventCount,
          journalEntryCount,
          reminderTaskCount,
          nonInitialTransactionCount,
        },
      );
    }

    await tx.seedBatch.delete({ where: { id: seedBatchId } });
    await writeAuditLog(tx, auth, "seedBatch.delete", "SeedBatch", seedBatchId, {});
  });

  await Promise.all(mediaAssets.map((asset) => deleteStoredMedia(asset.storageKey)));
}

export async function listGrowingProfiles(auth: AuthContext) {
  return prisma.growingProfile.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function createGrowingProfile(
  auth: AuthContext,
  input: {
    name: string;
    lastFrostDate: string;
    firstFrostDate: string;
    phenologyStage?: string | null;
    phenologyObservedAt?: string | null;
    phenologyNotes?: string | null;
    notes?: string | null;
    isActive: boolean;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.growingProfile.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    }

    const profile = await tx.growingProfile.create({
      data: {
        workspaceId: auth.workspaceId,
        name: input.name,
        lastFrostDate: new Date(input.lastFrostDate),
        firstFrostDate: new Date(input.firstFrostDate),
        phenologyStage: input.phenologyStage ?? null,
        phenologyObservedAt: input.phenologyObservedAt ? new Date(input.phenologyObservedAt) : null,
        phenologyNotes: input.phenologyNotes ?? null,
        notes: input.notes ?? null,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, auth, "growingProfile.create", "GrowingProfile", profile.id, {
      name: profile.name,
      isActive: profile.isActive,
    });

    return profile;
  });
}

export async function updateGrowingProfile(
  auth: AuthContext,
  profileId: string,
  input: {
    name?: string;
    lastFrostDate?: string;
    firstFrostDate?: string;
    phenologyStage?: string | null;
    phenologyObservedAt?: string | null;
    phenologyNotes?: string | null;
    notes?: string | null;
    isActive?: boolean;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertGrowingProfileInWorkspace(tx, auth.workspaceId, profileId);

    if (input.isActive) {
      await tx.growingProfile.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          isActive: true,
          NOT: { id: profileId },
        },
        data: {
          isActive: false,
        },
      });
    }

    const profile = await tx.growingProfile.update({
      where: { id: profileId },
      data: {
        name: input.name,
        lastFrostDate: input.lastFrostDate ? new Date(input.lastFrostDate) : undefined,
        firstFrostDate: input.firstFrostDate ? new Date(input.firstFrostDate) : undefined,
        phenologyStage: input.phenologyStage,
        phenologyObservedAt:
          input.phenologyObservedAt === undefined
            ? undefined
            : input.phenologyObservedAt === null
              ? null
              : new Date(input.phenologyObservedAt),
        phenologyNotes: input.phenologyNotes,
        notes: input.notes,
        isActive: input.isActive,
      },
    });

    await writeAuditLog(tx, auth, "growingProfile.update", "GrowingProfile", profile.id, {
      fields: Object.keys(input),
      isActive: profile.isActive,
    });

    return profile;
  });
}

export async function deleteGrowingProfile(auth: AuthContext, profileId: string) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertGrowingProfileInWorkspace(tx, auth.workspaceId, profileId);
    await tx.growingProfile.delete({ where: { id: profileId } });
    await writeAuditLog(tx, auth, "growingProfile.delete", "GrowingProfile", profileId, {});
  });
}

export async function listCultivationRules(auth: AuthContext) {
  return prisma.cultivationRule.findMany({
    where: {
      variety: {
        workspaceId: auth.workspaceId,
      },
    },
    include: {
      variety: true,
    },
    orderBy: {
      variety: {
        name: "asc",
      },
    },
  });
}

export async function upsertCultivationRule(
  auth: AuthContext,
  input: {
    varietyId: string;
    sowIndoorsStartWeeks?: number | null;
    sowIndoorsEndWeeks?: number | null;
    sowOutdoorsStartWeeks?: number | null;
    sowOutdoorsEndWeeks?: number | null;
    transplantStartWeeks?: number | null;
    transplantEndWeeks?: number | null;
    harvestStartDays?: number | null;
    harvestEndDays?: number | null;
    spacingCm?: number | null;
    successionIntervalDays?: number | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);

    const rule = await tx.cultivationRule.upsert({
      where: { varietyId: input.varietyId },
      create: {
        ...input,
      },
      update: {
        ...input,
      },
    });

    await writeAuditLog(tx, auth, "cultivationRule.upsert", "CultivationRule", rule.id, {
      varietyId: rule.varietyId,
    });

    return rule;
  });
}

export async function updateCultivationRule(
  auth: AuthContext,
  ruleId: string,
  input: {
    varietyId?: string;
    sowIndoorsStartWeeks?: number | null;
    sowIndoorsEndWeeks?: number | null;
    sowOutdoorsStartWeeks?: number | null;
    sowOutdoorsEndWeeks?: number | null;
    transplantStartWeeks?: number | null;
    transplantEndWeeks?: number | null;
    harvestStartDays?: number | null;
    harvestEndDays?: number | null;
    spacingCm?: number | null;
    successionIntervalDays?: number | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const existingRule = await tx.cultivationRule.findFirst({
      where: {
        id: ruleId,
        variety: {
          workspaceId: auth.workspaceId,
        },
      },
    });

    if (!existingRule) {
      throw new ApiError(404, "CULTIVATION_RULE_NOT_FOUND", "Cultivation rule was not found in this workspace.");
    }

    if (input.varietyId) {
      await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);

      const conflictingRule = await tx.cultivationRule.findFirst({
        where: {
          varietyId: input.varietyId,
          NOT: { id: ruleId },
        },
      });

      if (conflictingRule) {
        throw new ApiError(
          409,
          "CULTIVATION_RULE_VARIETY_CONFLICT",
          "This variety already has a cultivation rule.",
          { varietyId: input.varietyId },
        );
      }
    }

    const rule = await tx.cultivationRule.update({
      where: { id: ruleId },
      data: {
        varietyId: input.varietyId,
        sowIndoorsStartWeeks: input.sowIndoorsStartWeeks,
        sowIndoorsEndWeeks: input.sowIndoorsEndWeeks,
        sowOutdoorsStartWeeks: input.sowOutdoorsStartWeeks,
        sowOutdoorsEndWeeks: input.sowOutdoorsEndWeeks,
        transplantStartWeeks: input.transplantStartWeeks,
        transplantEndWeeks: input.transplantEndWeeks,
        harvestStartDays: input.harvestStartDays,
        harvestEndDays: input.harvestEndDays,
        spacingCm: input.spacingCm,
        successionIntervalDays: input.successionIntervalDays,
      },
    });

    await writeAuditLog(tx, auth, "cultivationRule.update", "CultivationRule", rule.id, {
      fields: Object.keys(input),
      varietyId: rule.varietyId,
    });

    return rule;
  });
}

export async function deleteCultivationRule(auth: AuthContext, ruleId: string) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const existingRule = await tx.cultivationRule.findFirst({
      where: {
        id: ruleId,
        variety: {
          workspaceId: auth.workspaceId,
        },
      },
    });

    if (!existingRule) {
      throw new ApiError(404, "CULTIVATION_RULE_NOT_FOUND", "Cultivation rule was not found in this workspace.");
    }

    await tx.cultivationRule.delete({ where: { id: ruleId } });
    await writeAuditLog(tx, auth, "cultivationRule.delete", "CultivationRule", ruleId, {
      varietyId: existingRule.varietyId,
    });
  });
}

export async function listPlantingEvents(auth: AuthContext) {
  return prisma.plantingEvent.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ actualDate: "desc" }, { plannedDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function createPlantingEvent(
  auth: AuthContext,
  input: {
    varietyId: string;
    seedBatchId?: string | null;
    growingProfileId?: string | null;
    type: Prisma.PlantingEventCreateInput["type"];
    plannedDate?: string | null;
    actualDate?: string | null;
    quantityUsed?: number | null;
    locationNote?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);

    if (input.growingProfileId) {
      await assertGrowingProfileInWorkspace(tx, auth.workspaceId, input.growingProfileId);
    }

    let nextQuantity: Prisma.Decimal | null = null;
    let quantityBefore: Prisma.Decimal | null = null;

    if (input.seedBatchId) {
      const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, input.seedBatchId);

      if (input.quantityUsed) {
        quantityBefore = new Prisma.Decimal(seedBatch.quantity);
        const remainingQuantity = quantityBefore.minus(input.quantityUsed);

        if (remainingQuantity.isNegative()) {
          throw new ApiError(
            409,
            "INSUFFICIENT_SEED_STOCK",
            "Seed batch quantity would fall below zero.",
          );
        }

        nextQuantity = remainingQuantity;

        await tx.seedBatch.update({
          where: {
            id: seedBatch.id,
          },
          data: {
            quantity: remainingQuantity,
          },
        });
      }
    }

    const plantingEvent = await tx.plantingEvent.create({
      data: {
        workspaceId: auth.workspaceId,
        varietyId: input.varietyId,
        seedBatchId: input.seedBatchId ?? null,
        growingProfileId: input.growingProfileId ?? null,
        type: input.type,
        plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
        actualDate: input.actualDate ? new Date(input.actualDate) : null,
        quantityUsed: input.quantityUsed ? new Prisma.Decimal(input.quantityUsed) : null,
        locationNote: input.locationNote ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.seedBatchId && input.quantityUsed && quantityBefore && nextQuantity) {
      await tx.seedBatchTransaction.create({
        data: {
          workspaceId: auth.workspaceId,
          seedBatchId: input.seedBatchId,
          plantingEventId: plantingEvent.id,
          type: SeedBatchTransactionType.PLANTING_CONSUMPTION,
          quantityDelta: new Prisma.Decimal(input.quantityUsed).negated(),
          quantityBefore,
          quantityAfter: nextQuantity,
          effectiveDate: input.actualDate
            ? new Date(input.actualDate)
            : input.plannedDate
              ? new Date(input.plannedDate)
              : new Date(),
          reason: `Stock consumed by planting event ${plantingEvent.id}.`,
        },
      });
    }

    await writeAuditLog(tx, auth, "plantingEvent.create", "PlantingEvent", plantingEvent.id, {
      type: plantingEvent.type,
      varietyId: plantingEvent.varietyId,
      seedBatchId: plantingEvent.seedBatchId,
      quantityUsed: plantingEvent.quantityUsed?.toString() ?? null,
      remainingSeedQuantity: nextQuantity?.toString() ?? null,
    });

    return plantingEvent;
  });
}

async function restorePlantingConsumptionStock(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  plantingEventId: string,
) {
  const linkedTransactions = await tx.seedBatchTransaction.findMany({
    where: {
      workspaceId: auth.workspaceId,
      plantingEventId,
      type: SeedBatchTransactionType.PLANTING_CONSUMPTION,
    },
  });

  if (linkedTransactions.length > 1) {
    throw new ApiError(
      409,
      "PLANTING_EVENT_UPDATE_BLOCKED",
      "Planting event has multiple stock transactions and cannot be edited safely.",
      { plantingEventId },
    );
  }

  const linkedTransaction = linkedTransactions[0];

  if (!linkedTransaction) {
    return null;
  }

  const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, linkedTransaction.seedBatchId);
  const quantityAfterRestore = new Prisma.Decimal(seedBatch.quantity).minus(linkedTransaction.quantityDelta);

  await tx.seedBatch.update({
    where: { id: seedBatch.id },
    data: {
      quantity: quantityAfterRestore,
    },
  });

  await tx.seedBatchTransaction.delete({
    where: { id: linkedTransaction.id },
  });

  return linkedTransaction;
}

async function applyPlantingConsumptionStock(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  plantingEventId: string,
  input: {
    seedBatchId?: string | null;
    quantityUsed?: number | null;
    actualDate?: string | null;
    plannedDate?: string | null;
  },
) {
  if (!input.seedBatchId || !input.quantityUsed) {
    return null;
  }

  const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, input.seedBatchId);
  const quantityBefore = new Prisma.Decimal(seedBatch.quantity);
  const quantityAfter = quantityBefore.minus(input.quantityUsed);

  if (quantityAfter.isNegative()) {
    throw new ApiError(
      409,
      "INSUFFICIENT_SEED_STOCK",
      "Seed batch quantity would fall below zero.",
    );
  }

  await tx.seedBatch.update({
    where: { id: seedBatch.id },
    data: {
      quantity: quantityAfter,
    },
  });

  return tx.seedBatchTransaction.create({
    data: {
      workspaceId: auth.workspaceId,
      seedBatchId: input.seedBatchId,
      plantingEventId,
      type: SeedBatchTransactionType.PLANTING_CONSUMPTION,
      quantityDelta: new Prisma.Decimal(input.quantityUsed).negated(),
      quantityBefore,
      quantityAfter,
      effectiveDate: input.actualDate
        ? new Date(input.actualDate)
        : input.plannedDate
          ? new Date(input.plannedDate)
          : new Date(),
      reason: `Stock consumed by planting event ${plantingEventId}.`,
    },
  });
}

export async function updatePlantingEvent(
  auth: AuthContext,
  plantingEventId: string,
  input: {
    varietyId?: string;
    seedBatchId?: string | null;
    growingProfileId?: string | null;
    type?: Prisma.PlantingEventUpdateInput["type"];
    plannedDate?: string | null;
    actualDate?: string | null;
    quantityUsed?: number | null;
    locationNote?: string | null;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const existingEvent = await assertPlantingEventInWorkspace(tx, auth.workspaceId, plantingEventId);

    if (input.varietyId) {
      await assertVarietyInWorkspace(tx, auth.workspaceId, input.varietyId);
    }

    if (input.growingProfileId) {
      await assertGrowingProfileInWorkspace(tx, auth.workspaceId, input.growingProfileId);
    }

    if (input.seedBatchId) {
      await assertSeedBatchInWorkspace(tx, auth.workspaceId, input.seedBatchId);
    }

    await restorePlantingConsumptionStock(tx, auth, plantingEventId);

    const nextEventValues = {
      varietyId: input.varietyId ?? existingEvent.varietyId,
      seedBatchId: input.seedBatchId === undefined ? existingEvent.seedBatchId : input.seedBatchId,
      growingProfileId:
        input.growingProfileId === undefined ? existingEvent.growingProfileId : input.growingProfileId,
      type: input.type ?? existingEvent.type,
      plannedDate: input.plannedDate === undefined ? existingEvent.plannedDate : input.plannedDate ? new Date(input.plannedDate) : null,
      actualDate: input.actualDate === undefined ? existingEvent.actualDate : input.actualDate ? new Date(input.actualDate) : null,
      quantityUsed:
        input.quantityUsed === undefined
          ? existingEvent.quantityUsed
          : input.quantityUsed === null
            ? null
            : new Prisma.Decimal(input.quantityUsed),
      locationNote: input.locationNote === undefined ? existingEvent.locationNote : input.locationNote,
      notes: input.notes === undefined ? existingEvent.notes : input.notes,
    };

    const plantingEvent = await tx.plantingEvent.update({
      where: { id: plantingEventId },
      data: nextEventValues,
    });

    const stockTransaction = await applyPlantingConsumptionStock(tx, auth, plantingEventId, {
      seedBatchId: plantingEvent.seedBatchId,
      quantityUsed: plantingEvent.quantityUsed ? Number(plantingEvent.quantityUsed.toString()) : null,
      actualDate: plantingEvent.actualDate?.toISOString() ?? null,
      plannedDate: plantingEvent.plannedDate?.toISOString() ?? null,
    });

    await writeAuditLog(tx, auth, "plantingEvent.update", "PlantingEvent", plantingEvent.id, {
      fields: Object.keys(input),
      seedBatchId: plantingEvent.seedBatchId,
      quantityUsed: plantingEvent.quantityUsed?.toString() ?? null,
      stockTransactionId: stockTransaction?.id ?? null,
    });

    return plantingEvent;
  });
}

export async function deletePlantingEvent(auth: AuthContext, plantingEventId: string) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertPlantingEventInWorkspace(tx, auth.workspaceId, plantingEventId);
    await restorePlantingConsumptionStock(tx, auth, plantingEventId);
    await tx.plantingEvent.delete({ where: { id: plantingEventId } });
    await writeAuditLog(tx, auth, "plantingEvent.delete", "PlantingEvent", plantingEventId, {});
  });
}

export async function listAuditLogs(auth: AuthContext) {
  return prisma.auditLog.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listGerminationTests(auth: AuthContext, seedBatchId: string) {
  await assertSeedBatchInWorkspace(prisma, auth.workspaceId, seedBatchId);

  return prisma.germinationTest.findMany({
    where: {
      workspaceId: auth.workspaceId,
      seedBatchId,
    },
    orderBy: { testedAt: "desc" },
  });
}

export async function createGerminationTest(
  auth: AuthContext,
  seedBatchId: string,
  input: {
    testedAt: string;
    sampleSize: number;
    germinatedCount: number;
    notes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);

    const germinationRate = calculateGerminationRate(input.sampleSize, input.germinatedCount);
    const test = await tx.germinationTest.create({
      data: {
        workspaceId: auth.workspaceId,
        seedBatchId,
        testedAt: new Date(input.testedAt),
        sampleSize: input.sampleSize,
        germinatedCount: input.germinatedCount,
        germinationRate,
        notes: input.notes ?? null,
      },
    });

    await writeAuditLog(tx, auth, "germinationTest.create", "GerminationTest", test.id, {
      seedBatchId,
      germinationRate: germinationRate.toString(),
    });

    return test;
  });
}

export async function listSeedBatchTransactions(auth: AuthContext, seedBatchId: string) {
  await assertSeedBatchInWorkspace(prisma, auth.workspaceId, seedBatchId);

  return prisma.seedBatchTransaction.findMany({
    where: {
      workspaceId: auth.workspaceId,
      seedBatchId,
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function adjustSeedBatchStock(
  auth: AuthContext,
  seedBatchId: string,
  input: {
    mode: "SET_ABSOLUTE" | "ADJUST_DELTA";
    quantity: number;
    reason: string;
    effectiveDate: string;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);
    const quantityBefore = new Prisma.Decimal(seedBatch.quantity);
    const quantityDelta =
      input.mode === "SET_ABSOLUTE"
        ? new Prisma.Decimal(input.quantity).minus(quantityBefore)
        : new Prisma.Decimal(input.quantity);
    const quantityAfter = quantityBefore.plus(quantityDelta);

    if (quantityAfter.isNegative()) {
      throw new ApiError(409, "INSUFFICIENT_SEED_STOCK", "Stock correction would make quantity negative.");
    }

    const updatedBatch = await tx.seedBatch.update({
      where: { id: seedBatch.id },
      data: { quantity: quantityAfter },
      include: {
        germinationTests: { orderBy: { testedAt: "desc" } },
        stockTransactions: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] },
      },
    });

    const transaction = await tx.seedBatchTransaction.create({
      data: {
        workspaceId: auth.workspaceId,
        seedBatchId,
        type: SeedBatchTransactionType.MANUAL_CORRECTION,
        quantityDelta,
        quantityBefore,
        quantityAfter,
        effectiveDate: new Date(input.effectiveDate),
        reason: input.reason,
      },
    });

    await writeAuditLog(tx, auth, "seedBatch.adjust", "SeedBatchTransaction", transaction.id, {
      seedBatchId,
      mode: input.mode,
      quantityDelta: quantityDelta.toString(),
      quantityAfter: quantityAfter.toString(),
    });

    return {
      seedBatch: {
        ...updatedBatch,
        storageWarnings: buildSeedBatchWarnings({
          harvestYear: updatedBatch.harvestYear,
          storageLocation: updatedBatch.storageLocation,
          storageTemperatureC: updatedBatch.storageTemperatureC,
          storageHumidityPercent: updatedBatch.storageHumidityPercent,
          storageLightExposure: updatedBatch.storageLightExposure,
          storageMoistureLevel: updatedBatch.storageMoistureLevel,
          latestGerminationRate: updatedBatch.germinationTests[0]?.germinationRate ?? null,
          latestGerminationTestedAt: updatedBatch.germinationTests[0]?.testedAt ?? null,
        }),
      },
      transaction,
    };
  });
}

export async function reverseSeedBatchTransaction(
  auth: AuthContext,
  seedBatchId: string,
  transactionId: string,
  input: { reason: string; effectiveDate: string },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);
    const transaction = await tx.seedBatchTransaction.findFirst({
      where: {
        id: transactionId,
        workspaceId: auth.workspaceId,
        seedBatchId,
      },
    });

    if (!transaction) {
      throw new ApiError(404, "STOCK_TRANSACTION_NOT_FOUND", "Stock transaction was not found.");
    }

    if (transaction.type === SeedBatchTransactionType.REVERSAL) {
      throw new ApiError(409, "REVERSAL_NOT_ALLOWED", "A reversal transaction cannot be reversed again.");
    }

    const existingReversal = await tx.seedBatchTransaction.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        seedBatchId,
        reversalOfId: transaction.id,
      },
    });

    if (existingReversal) {
      throw new ApiError(409, "TRANSACTION_ALREADY_REVERSED", "This stock transaction has already been reversed.");
    }

    const quantityBefore = new Prisma.Decimal(seedBatch.quantity);
    const quantityDelta = new Prisma.Decimal(transaction.quantityDelta).negated();
    const quantityAfter = quantityBefore.plus(quantityDelta);

    if (quantityAfter.isNegative()) {
      throw new ApiError(409, "INSUFFICIENT_SEED_STOCK", "Reversal would make quantity negative.");
    }

    const updatedBatch = await tx.seedBatch.update({
      where: { id: seedBatch.id },
      data: { quantity: quantityAfter },
      include: {
        germinationTests: { orderBy: { testedAt: "desc" } },
        stockTransactions: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] },
      },
    });

    const reversal = await tx.seedBatchTransaction.create({
      data: {
        workspaceId: auth.workspaceId,
        seedBatchId,
        type: SeedBatchTransactionType.REVERSAL,
        quantityDelta,
        quantityBefore,
        quantityAfter,
        effectiveDate: new Date(input.effectiveDate),
        reason: input.reason,
        reversalOfId: transaction.id,
      },
    });

    await writeAuditLog(tx, auth, "seedBatch.reverseTransaction", "SeedBatchTransaction", reversal.id, {
      seedBatchId,
      reversalOfId: transaction.id,
      quantityDelta: quantityDelta.toString(),
    });

    return {
      seedBatch: {
        ...updatedBatch,
        storageWarnings: buildSeedBatchWarnings({
          harvestYear: updatedBatch.harvestYear,
          storageLocation: updatedBatch.storageLocation,
          storageTemperatureC: updatedBatch.storageTemperatureC,
          storageHumidityPercent: updatedBatch.storageHumidityPercent,
          storageLightExposure: updatedBatch.storageLightExposure,
          storageMoistureLevel: updatedBatch.storageMoistureLevel,
          latestGerminationRate: updatedBatch.germinationTests[0]?.germinationRate ?? null,
          latestGerminationTestedAt: updatedBatch.germinationTests[0]?.testedAt ?? null,
        }),
      },
      transaction: reversal,
    };
  });
}

export async function updateProfilePhenology(
  auth: AuthContext,
  profileId: string,
  input: {
    phenologyStage: string | null;
    phenologyObservedAt?: string | null;
    phenologyNotes?: string | null;
  },
) {
  requireWriteAccess(auth);

  return prisma.$transaction(async (tx) => {
    await assertGrowingProfileInWorkspace(tx, auth.workspaceId, profileId);

    const profile = await tx.growingProfile.update({
      where: { id: profileId },
      data: {
        phenologyStage: input.phenologyStage,
        phenologyObservedAt: input.phenologyObservedAt ? new Date(input.phenologyObservedAt) : null,
        phenologyNotes: input.phenologyNotes ?? null,
      },
    });

    await writeAuditLog(tx, auth, "growingProfile.updatePhenology", "GrowingProfile", profile.id, {
      phenologyStage: profile.phenologyStage,
    });

    return profile;
  });
}
