export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[];
    } | null;
  };
};

export type User = {
  id: string;
  email: string;
  isActive: boolean;
  role: "ADMIN" | "MEMBER";
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  visibility: "PRIVATE" | "SHARED";
  createdAt: string;
  updatedAt: string;
};

export type Membership = {
  role: "OWNER" | "MEMBER" | "VIEWER";
  workspace: Workspace;
};

export type SessionSnapshot = {
  user: User;
  membership: Membership;
};

export type Species = {
  id: string;
  workspaceId: string;
  commonName: string;
  latinName: string | null;
  category: "VEGETABLE" | "FRUIT" | "HERB" | "FLOWER" | "OTHER";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CultivationRule = {
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
  createdAt: string;
  updatedAt: string;
};

export type Variety = {
  id: string;
  workspaceId: string;
  speciesId: string;
  name: string;
  description: string | null;
  heirloom: boolean;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  species?: {
    id: string;
    commonName: string;
    latinName: string | null;
    category: Species["category"];
  };
  synonyms?: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  cultivationRule?: CultivationRule | null;
};

export type SeedBatch = {
  id: string;
  workspaceId: string;
  varietyId: string;
  source: string | null;
  harvestYear: number | null;
  quantity: string | null;
  unit: "SEEDS" | "PACKETS" | "GRAMS";
  storageLocation: string | null;
  storageTemperatureC?: string | null;
  storageHumidityPercent?: number | null;
  storageLightExposure?: "DARK" | "INDIRECT" | "BRIGHT" | null;
  storageMoistureLevel?: "DRY" | "MODERATE" | "HUMID" | null;
  storageContainer?: string | null;
  storageQualityCheckedAt?: string | null;
  storageWarnings?: SeedBatchWarning[];
  germinationTests?: GerminationTest[];
  stockTransactions?: SeedBatchTransaction[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowingProfile = {
  id: string;
  workspaceId: string;
  name: string;
  lastFrostDate: string;
  firstFrostDate: string;
  notes: string | null;
  isActive: boolean;
  phenologyStage?: string | null;
  phenologyObservedAt?: string | null;
  phenologyNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlantingEvent = {
  id: string;
  workspaceId: string;
  varietyId: string;
  seedBatchId: string | null;
  growingProfileId: string | null;
  type: "SOW_INDOORS" | "SOW_OUTDOORS" | "TRANSPLANT" | "HARVEST";
  plannedDate: string | null;
  actualDate: string | null;
  quantityUsed: string | null;
  locationNote: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarItem =
  | {
      kind: "window";
      type: PlantingEvent["type"];
      label: string;
      varietyId: string;
      varietyName: string;
      speciesName: string;
      windowStart: string;
      windowEnd: string;
      recommendedDate: string;
    }
  | {
      kind: "recorded";
      date: string;
      event: PlantingEvent;
      varietyName: string;
    }
  | {
      kind: "harvest";
      type: "HARVEST";
      label: string;
      dateStart: string;
      dateEnd: string | null;
      varietyId: string;
      varietyName: string;
      sourcePlantingEventId: string;
    };

export type DashboardData = {
  species: Species[];
  varieties: Variety[];
  seedBatches: SeedBatch[];
  profiles: GrowingProfile[];
  rules: Array<
    CultivationRule & {
      variety: {
        id: string;
        name: string;
      };
    }
  >;
  calendar: CalendarItem[];
  plantings: PlantingEvent[];
  journal: JournalEntry[];
};

export type JournalEntry = {
  id: string;
  workspaceId: string;
  varietyId: string | null;
  seedBatchId: string | null;
  plantingEventId: string | null;
  entryType: "OBSERVATION" | "TASK_NOTE" | "PEST_NOTE" | "WEATHER_NOTE" | "HARVEST_NOTE" | "SEED_SAVED";
  title: string;
  details: string | null;
  entryDate: string;
  quantity: string | null;
  unit: SeedBatch["unit"] | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserInvite = {
  id: string;
  workspaceId: string;
  email: string;
  role: Membership["role"];
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  role: Membership["role"];
  createdAt: string;
  user: User;
};

export type GerminationTest = {
  id: string;
  workspaceId: string;
  seedBatchId: string;
  testedAt: string;
  sampleSize: number;
  germinatedCount: number;
  germinationRate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SeedBatchTransaction = {
  id: string;
  workspaceId: string;
  seedBatchId: string;
  plantingEventId: string | null;
  type: "INITIAL_STOCK" | "PLANTING_CONSUMPTION" | "MANUAL_CORRECTION" | "REVERSAL";
  quantityDelta: string | null;
  quantityBefore: string | null;
  quantityAfter: string | null;
  effectiveDate: string;
  reason: string | null;
  reversalOfId: string | null;
  createdAt: string;
};

export type SeedBatchWarning = {
  level: "info" | "warning" | "critical";
  code: string;
  title: string;
  detail: string;
};

export type ReminderTask = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  assignedUserId: string | null;
  varietyId: string | null;
  seedBatchId: string | null;
  plantingEventId: string | null;
  title: string;
  details: string | null;
  dueDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
  source: "MANUAL" | "CALENDAR" | "JOURNAL" | "QUALITY" | "SYSTEM";
  tags: string[];
  completedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimelineItem =
  | {
      kind: "task";
      date: string;
      task: ReminderTask;
    }
  | {
      kind: "journal";
      date: string;
      entry: JournalEntry;
    }
  | {
      kind: "planting";
      date: string;
      event: PlantingEvent;
    };

export type ApiToken = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  tokenPrefix: string;
  scopes: Array<"READ" | "WRITE" | "EXPORT" | "ADMIN">;
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
