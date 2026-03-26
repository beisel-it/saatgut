import { MembershipRole, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { AuthContext } from "@/lib/server/auth-context";

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

export async function listVarieties(auth: AuthContext) {
  return prisma.variety.findMany({
    where: { workspaceId: auth.workspaceId },
    include: {
      species: true,
      synonyms: true,
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
            { notes: { contains: filters.q, mode: "insensitive" } },
            { species: { commonName: { contains: filters.q, mode: "insensitive" } } },
            { synonyms: { some: { name: { contains: filters.q, mode: "insensitive" } } } },
          ]
        : undefined,
    },
    include: {
      species: true,
      synonyms: true,
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

export async function listSeedBatches(auth: AuthContext) {
  return prisma.seedBatch.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ harvestYear: "desc" }, { createdAt: "desc" }],
  });
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
        notes: input.notes ?? null,
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

    if (input.seedBatchId) {
      const seedBatch = await assertSeedBatchInWorkspace(tx, auth.workspaceId, input.seedBatchId);

      if (input.quantityUsed) {
        const remainingQuantity = new Prisma.Decimal(seedBatch.quantity).minus(input.quantityUsed);

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

export async function listAuditLogs(auth: AuthContext) {
  return prisma.auditLog.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
