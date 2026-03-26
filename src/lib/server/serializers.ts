import {
  MembershipRole,
  PlantingEventType,
  SeedQuantityUnit,
  SpeciesCategory,
  UserRole,
  WorkspaceVisibility,
} from "@prisma/client";

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
    ...user,
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
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...seedBatch,
    quantity: serializeDecimal(seedBatch.quantity),
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
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...profile,
    lastFrostDate: profile.lastFrostDate.toISOString(),
    firstFrostDate: profile.firstFrostDate.toISOString(),
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
    ...invite,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    updatedAt: invite.updatedAt.toISOString(),
  };
}
