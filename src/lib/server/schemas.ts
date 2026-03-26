import {
  ApiTokenScope,
  MembershipRole,
  PlantingEventType,
  PlantingJournalEntryType,
  ReminderTaskSource,
  ReminderTaskStatus,
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

export const passkeySignupStartSchema = z.object({
  email: z.string().email(),
  workspaceName: z.string().trim().min(1).max(120).optional(),
});

export const passkeyResponseSchema = z.object({
  response: z.unknown(),
});

export const mediaMetadataSchema = z.object({
  altText: z.string().trim().max(300).optional().nullable(),
  caption: z.string().trim().max(1000).optional().nullable(),
});

export const seedBatchPhotoMetadataSchema = mediaMetadataSchema.extend({
  kind: z.enum(["SEED_BATCH_PACKET", "SEED_BATCH_REFERENCE"]),
});

export const speciesCreateSchema = z.object({
  commonName: z.string().trim().min(1).max(120),
  latinName: z.string().trim().min(1).max(160).optional().nullable(),
  category: z.nativeEnum(SpeciesCategory).default(SpeciesCategory.VEGETABLE),
  germinationNotes: z.string().trim().max(2000).optional().nullable(),
  preferredLocation: z.string().trim().max(500).optional().nullable(),
  companionPlantingNotes: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const speciesUpdateSchema = speciesCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one species field must be provided.",
  });

export const varietyCreateSchema = z.object({
  speciesId: z.string().cuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  heirloom: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
  germinationNotes: z.string().trim().max(2000).optional().nullable(),
  preferredLocation: z.string().trim().max(500).optional().nullable(),
  companionPlantingNotes: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  synonyms: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
});

export const varietyUpdateSchema = varietyCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one variety field must be provided.",
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

export const seedBatchUpdateSchema = z.object({
  varietyId: z.string().cuid().optional(),
  source: z.string().trim().max(160).optional().nullable(),
  harvestYear: z.number().int().min(1900).max(2100).optional().nullable(),
  storageLocation: z.string().trim().max(160).optional().nullable(),
  storageTemperatureC: z.number().min(-30).max(60).optional().nullable(),
  storageHumidityPercent: z.number().int().min(0).max(100).optional().nullable(),
  storageLightExposure: z.nativeEnum(StorageLightExposure).optional().nullable(),
  storageMoistureLevel: z.nativeEnum(StorageMoistureLevel).optional().nullable(),
  storageContainer: z.string().trim().max(160).optional().nullable(),
  storageQualityCheckedAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one seed batch field must be provided.",
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

export const growingProfileUpdateSchema = growingProfileCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided.",
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

export const cultivationRuleUpdateSchema = cultivationRuleUpsertSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one cultivation rule field must be provided.",
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

export const plantingEventUpdateSchema = plantingEventCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one planting field must be provided.",
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
  password: z.string().min(8).optional(),
});

export const workspaceMemberRoleUpdateSchema = z.object({
  role: z.enum([MembershipRole.MEMBER, MembershipRole.VIEWER]),
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

export const reminderTaskCreateSchema = z.object({
  assignedUserId: z.string().cuid().optional().nullable(),
  varietyId: z.string().cuid().optional().nullable(),
  seedBatchId: z.string().cuid().optional().nullable(),
  plantingEventId: z.string().cuid().optional().nullable(),
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().max(4000).optional().nullable(),
  dueDate: z.string().datetime(),
  source: z.nativeEnum(ReminderTaskSource).default(ReminderTaskSource.MANUAL),
  tags: z.array(z.string().trim().min(1).max(48)).max(12).default([]),
});

export const reminderTaskQuerySchema = z.object({
  status: z.nativeEnum(ReminderTaskStatus).optional(),
  assignedUserId: z.string().cuid().optional(),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
  tag: z.string().trim().min(1).optional(),
});

export const reminderTaskStatusUpdateSchema = z.object({
  status: z.nativeEnum(ReminderTaskStatus),
});

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const apiTokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.nativeEnum(ApiTokenScope)).min(1).max(4),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
  rateLimitPerMinute: z.number().int().positive().max(5000).optional().nullable(),
});
