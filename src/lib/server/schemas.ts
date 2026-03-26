import {
  MembershipRole,
  PlantingEventType,
  PlantingJournalEntryType,
  StorageLightExposure,
  StorageMoistureLevel,
  SeedQuantityUnit,
  SpeciesCategory,
} from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().trim().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const speciesCreateSchema = z.object({
  commonName: z.string().trim().min(1).max(120),
  latinName: z.string().trim().min(1).max(160).optional().nullable(),
  category: z.nativeEnum(SpeciesCategory).default(SpeciesCategory.VEGETABLE),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const varietyCreateSchema = z.object({
  speciesId: z.string().cuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  heirloom: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
  notes: z.string().trim().max(2000).optional().nullable(),
  synonyms: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
});

export const seedBatchCreateSchema = z.object({
  varietyId: z.string().cuid(),
  source: z.string().trim().max(160).optional().nullable(),
  harvestYear: z.number().int().min(1900).max(2100).optional().nullable(),
  quantity: z.number().positive(),
  unit: z.nativeEnum(SeedQuantityUnit).default(SeedQuantityUnit.SEEDS),
  storageLocation: z.string().trim().max(160).optional().nullable(),
  storageTemperatureC: z.number().min(-30).max(60).optional().nullable(),
  storageHumidityPercent: z.number().int().min(0).max(100).optional().nullable(),
  storageLightExposure: z.nativeEnum(StorageLightExposure).optional().nullable(),
  storageMoistureLevel: z.nativeEnum(StorageMoistureLevel).optional().nullable(),
  storageContainer: z.string().trim().max(160).optional().nullable(),
  storageQualityCheckedAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const growingProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  lastFrostDate: z.string().datetime(),
  firstFrostDate: z.string().datetime(),
  phenologyStage: z.string().trim().min(1).max(40).optional().nullable(),
  phenologyObservedAt: z.string().datetime().optional().nullable(),
  phenologyNotes: z.string().trim().max(1000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(false),
});

export const cultivationRuleUpsertSchema = z.object({
  varietyId: z.string().cuid(),
  sowIndoorsStartWeeks: z.number().int().min(0).max(52).optional().nullable(),
  sowIndoorsEndWeeks: z.number().int().min(0).max(52).optional().nullable(),
  sowOutdoorsStartWeeks: z.number().int().min(0).max(52).optional().nullable(),
  sowOutdoorsEndWeeks: z.number().int().min(0).max(52).optional().nullable(),
  transplantStartWeeks: z.number().int().min(0).max(52).optional().nullable(),
  transplantEndWeeks: z.number().int().min(0).max(52).optional().nullable(),
  harvestStartDays: z.number().int().min(0).max(365).optional().nullable(),
  harvestEndDays: z.number().int().min(0).max(365).optional().nullable(),
  spacingCm: z.number().int().min(0).max(1000).optional().nullable(),
  successionIntervalDays: z.number().int().min(0).max(365).optional().nullable(),
});

export const plantingEventCreateSchema = z.object({
  varietyId: z.string().cuid(),
  seedBatchId: z.string().cuid().optional().nullable(),
  growingProfileId: z.string().cuid().optional().nullable(),
  type: z.nativeEnum(PlantingEventType),
  plannedDate: z.string().datetime().optional().nullable(),
  actualDate: z.string().datetime().optional().nullable(),
  quantityUsed: z.number().positive().optional().nullable(),
  locationNote: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const calendarQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(60).default(14),
  from: z.string().datetime().optional(),
});

export const adminInviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.MEMBER),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const inviteAcceptSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const catalogQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.nativeEnum(SpeciesCategory).optional(),
  speciesId: z.string().cuid().optional(),
  heirloom: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  tag: z.string().trim().min(1).optional(),
});

export const journalEntryCreateSchema = z.object({
  varietyId: z.string().cuid().optional().nullable(),
  seedBatchId: z.string().cuid().optional().nullable(),
  plantingEventId: z.string().cuid().optional().nullable(),
  entryType: z.nativeEnum(PlantingJournalEntryType),
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().max(4000).optional().nullable(),
  entryDate: z.string().datetime(),
  quantity: z.number().positive().optional().nullable(),
  unit: z.nativeEnum(SeedQuantityUnit).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
});

export const journalQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  varietyId: z.string().cuid().optional(),
  seedBatchId: z.string().cuid().optional(),
  entryType: z.nativeEnum(PlantingJournalEntryType).optional(),
  tag: z.string().trim().min(1).optional(),
});

export const germinationTestCreateSchema = z.object({
  testedAt: z.string().datetime(),
  sampleSize: z.number().int().positive(),
  germinatedCount: z.number().int().min(0),
  notes: z.string().trim().max(2000).optional().nullable(),
}).refine((value) => value.germinatedCount <= value.sampleSize, {
  message: "Germinated count cannot exceed sample size.",
  path: ["germinatedCount"],
});

export const seedBatchAdjustmentCreateSchema = z.object({
  mode: z.enum(["SET_ABSOLUTE", "ADJUST_DELTA"]),
  quantity: z.number().positive(),
  reason: z.string().trim().min(1).max(500),
  effectiveDate: z.string().datetime(),
});

export const seedBatchReversalCreateSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  effectiveDate: z.string().datetime(),
});

export const phenologyUpdateSchema = z.object({
  phenologyStage: z.string().trim().min(1).max(40).nullable(),
  phenologyObservedAt: z.string().datetime().optional().nullable(),
  phenologyNotes: z.string().trim().max(1000).optional().nullable(),
});
