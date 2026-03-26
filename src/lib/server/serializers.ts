import {
  ApiTokenScope,
  GerminationTest,
  MembershipRole,
  PlantingEventType,
  ReminderTaskSource,
  ReminderTaskStatus,
  SeedBatchTransactionType,
  SeedQuantityUnit,
  SpeciesCategory,
  StorageLightExposure,
  StorageMoistureLevel,
  UserRole,
  WorkspaceVisibility,
} from "@prisma/client";

import type { SeedBatchWarning } from "@/lib/server/seed-batch-quality";

type Decimalish = { toString(): string } | null;

export function serializeDecimal(value: Decimalish): string | null {
  return value ? value.toString() : null;
}

export function serializeUser(user: {
  id: string;
  email: string;
  isActive: boolean;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    isActive: user.isActive,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeWorkspace(workspace: {
  id: string;
  name: string;
  visibility: WorkspaceVisibility;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...workspace,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export function serializeMembership(membership: {
  role: MembershipRole;
  workspace: {
    id: string;
    name: string;
    visibility: WorkspaceVisibility;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    role: membership.role,
    workspace: serializeWorkspace(membership.workspace),
  };
}

export function serializeWorkspaceMember(membership: {
  role: MembershipRole;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    isActive: boolean;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  };
}) {
  return {
    role: membership.role,
    createdAt: membership.createdAt.toISOString(),
    user: serializeUser(membership.user),
  };
}

export function serializeSpecies(species: {
  id: string;
  workspaceId: string;
  commonName: string;
  latinName: string | null;
  category: SpeciesCategory;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...species,
    createdAt: species.createdAt.toISOString(),
    updatedAt: species.updatedAt.toISOString(),
  };
}

export function serializeVariety(variety: {
  id: string;
  workspaceId: string;
  speciesId: string;
  name: string;
  description: string | null;
  heirloom: boolean;
  tags: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  species?: {
    id: string;
    commonName: string;
    latinName: string | null;
    category: SpeciesCategory;
  };
  synonyms?: Array<{ id: string; name: string; createdAt: Date }>;
  cultivationRule?: {
    id: string;
    sowIndoorsStartWeeks: number | null;
    sowIndoorsEndWeeks: number | null;
    sowOutdoorsStartWeeks: number | null;
    sowOutdoorsEndWeeks: number | null;
    transplantStartWeeks: number | null;
    transplantEndWeeks: number | null;
    harvestStartDays: number | null;
    harvestEndDays: number | null;
    spacingCm: number | null;
    successionIntervalDays: number | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}) {
  return {
    ...variety,
    createdAt: variety.createdAt.toISOString(),
    updatedAt: variety.updatedAt.toISOString(),
    synonyms: variety.synonyms?.map((synonym) => ({
      ...synonym,
      createdAt: synonym.createdAt.toISOString(),
    })),
    cultivationRule: variety.cultivationRule
      ? {
          ...variety.cultivationRule,
          createdAt: variety.cultivationRule.createdAt.toISOString(),
          updatedAt: variety.cultivationRule.updatedAt.toISOString(),
        }
      : null,
  };
}

export function serializeSeedBatch(seedBatch: {
  id: string;
  workspaceId: string;
  varietyId: string;
  source: string | null;
  harvestYear: number | null;
  quantity: Decimalish;
  unit: SeedQuantityUnit;
  storageLocation: string | null;
  storageTemperatureC?: Decimalish;
  storageHumidityPercent?: number | null;
  storageLightExposure?: StorageLightExposure | null;
  storageMoistureLevel?: StorageMoistureLevel | null;
  storageContainer?: string | null;
  storageQualityCheckedAt?: Date | null;
  notes: string | null;
  germinationTests?: GerminationTest[];
  stockTransactions?: Array<{
    id: string;
    seedBatchId: string;
    workspaceId: string;
    plantingEventId: string | null;
    type: SeedBatchTransactionType;
    quantityDelta: Decimalish;
    quantityBefore: Decimalish;
    quantityAfter: Decimalish;
    effectiveDate: Date;
    reason: string | null;
    reversalOfId: string | null;
    createdAt: Date;
  }>;
  storageWarnings?: SeedBatchWarning[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...seedBatch,
    quantity: serializeDecimal(seedBatch.quantity),
    storageTemperatureC: serializeDecimal(seedBatch.storageTemperatureC ?? null),
    storageQualityCheckedAt: seedBatch.storageQualityCheckedAt?.toISOString() ?? null,
    germinationTests: seedBatch.germinationTests?.map(serializeGerminationTest),
    stockTransactions: seedBatch.stockTransactions?.map(serializeSeedBatchTransaction),
    createdAt: seedBatch.createdAt.toISOString(),
    updatedAt: seedBatch.updatedAt.toISOString(),
  };
}

export function serializeGrowingProfile(profile: {
  id: string;
  workspaceId: string;
  name: string;
  lastFrostDate: Date;
  firstFrostDate: Date;
  phenologyStage: string | null;
  phenologyObservedAt: Date | null;
  phenologyNotes: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...profile,
    lastFrostDate: profile.lastFrostDate.toISOString(),
    firstFrostDate: profile.firstFrostDate.toISOString(),
    phenologyObservedAt: profile.phenologyObservedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function serializeCultivationRule(rule: {
  id: string;
  varietyId: string;
  sowIndoorsStartWeeks: number | null;
  sowIndoorsEndWeeks: number | null;
  sowOutdoorsStartWeeks: number | null;
  sowOutdoorsEndWeeks: number | null;
  transplantStartWeeks: number | null;
  transplantEndWeeks: number | null;
  harvestStartDays: number | null;
  harvestEndDays: number | null;
  spacingCm: number | null;
  successionIntervalDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...rule,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export function serializePlantingEvent(event: {
  id: string;
  workspaceId: string;
  varietyId: string;
  seedBatchId: string | null;
  growingProfileId: string | null;
  type: PlantingEventType;
  plannedDate: Date | null;
  actualDate: Date | null;
  quantityUsed: Decimalish;
  locationNote: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...event,
    quantityUsed: serializeDecimal(event.quantityUsed),
    plannedDate: event.plannedDate?.toISOString() ?? null,
    actualDate: event.actualDate?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function serializeAuditLog(log: {
  id: string;
  workspaceId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: unknown;
  createdAt: Date;
}) {
  return {
    ...log,
    createdAt: log.createdAt.toISOString(),
  };
}

export function serializeJournalEntry(entry: {
  id: string;
  workspaceId: string;
  varietyId: string | null;
  seedBatchId: string | null;
  plantingEventId: string | null;
  entryType: string;
  title: string;
  details: string | null;
  entryDate: Date;
  quantity: Decimalish;
  unit: SeedQuantityUnit | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...entry,
    quantity: serializeDecimal(entry.quantity),
    entryDate: entry.entryDate.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function serializeInvite(invite: {
  id: string;
  workspaceId: string;
  email: string;
  role: MembershipRole;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: invite.id,
    workspaceId: invite.workspaceId,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
  };
}

export function serializeGerminationTest(test: {
  id: string;
  workspaceId: string;
  seedBatchId: string;
  testedAt: Date;
  sampleSize: number;
  germinatedCount: number;
  germinationRate: Decimalish;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...test,
    germinationRate: serializeDecimal(test.germinationRate),
    testedAt: test.testedAt.toISOString(),
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString(),
  };
}

export function serializeSeedBatchTransaction(transaction: {
  id: string;
  workspaceId: string;
  seedBatchId: string;
  plantingEventId: string | null;
  type: SeedBatchTransactionType;
  quantityDelta: Decimalish;
  quantityBefore: Decimalish;
  quantityAfter: Decimalish;
  effectiveDate: Date;
  reason: string | null;
  reversalOfId: string | null;
  createdAt: Date;
}) {
  return {
    ...transaction,
    quantityDelta: serializeDecimal(transaction.quantityDelta),
    quantityBefore: serializeDecimal(transaction.quantityBefore),
    quantityAfter: serializeDecimal(transaction.quantityAfter),
    effectiveDate: transaction.effectiveDate.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function serializeReminderTask(task: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  assignedUserId: string | null;
  varietyId: string | null;
  seedBatchId: string | null;
  plantingEventId: string | null;
  title: string;
  details: string | null;
  dueDate: Date;
  status: ReminderTaskStatus;
  source: ReminderTaskSource;
  tags: string[];
  completedAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...task,
    dueDate: task.dueDate.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    dismissedAt: task.dismissedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function serializeApiToken(token: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  rateLimitPerMinute: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: token.id,
    workspaceId: token.workspaceId,
    createdByUserId: token.createdByUserId,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    scopes: token.scopes,
    rateLimitPerMinute: token.rateLimitPerMinute,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    revokedAt: token.revokedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString(),
    updatedAt: token.updatedAt.toISOString(),
  };
}
