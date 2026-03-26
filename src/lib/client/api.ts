import type {
  ApiErrorPayload,
  ApiToken,
  CalendarItem,
  CultivationRule,
  DashboardData,
  GrowingProfile,
  GerminationTest,
  JournalEntry,
  Membership,
  PlantingEvent,
  ReminderTask,
  SeedBatch,
  SeedBatchTransaction,
  SessionSnapshot,
  Species,
  TimelineItem,
  User,
  Variety,
} from "@/lib/client/types";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: Record<string, string[] | undefined>;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.error.message);
    this.code = payload.error.code;
    this.status = status;
    this.fieldErrors = payload.error.details?.fieldErrors ?? {};
  }
}

function getRequestLocale(): string {
  if (typeof document === "undefined") {
    return DEFAULT_LOCALE;
  }

  const lang = document.documentElement.lang || DEFAULT_LOCALE;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": getRequestLocale(),
      "X-Saatgut-Locale": getRequestLocale(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

    if (payload?.error) {
      throw new ApiClientError(payload, response.status);
    }

    throw new Error(`Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function getCollection<T>(url: string): Promise<T[]> {
  const result = await request<{ items: T[] }>(url, { method: "GET" });
  return result.items;
}

export function getSession() {
  return request<SessionSnapshot>("/api/v1/auth/session", { method: "GET" });
}

export function registerUser(input: {
  email: string;
  password: string;
  workspaceName?: string;
}) {
  return request<{ user: User; membership: Membership }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginUser(input: { email: string; password: string }) {
  return request<{ user: User; membership: Membership }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutUser() {
  return request<{ ok: true }>("/api/v1/auth/session", { method: "DELETE" });
}

export async function fetchDashboardData(days = 14): Promise<DashboardData> {
  const calendarPromise = getCollection<CalendarItem>(`/api/v1/calendar?days=${days}`).catch(
    (error) => {
      if (error instanceof ApiClientError && error.code === "ACTIVE_PROFILE_REQUIRED") {
        return [];
      }

      throw error;
    },
  );

  const [species, varieties, seedBatches, profiles, rules, calendar, plantings, journal] =
    await Promise.all([
      getCollection<Species>("/api/v1/species"),
      getCollection<Variety>("/api/v1/varieties"),
      getCollection<SeedBatch>("/api/v1/seed-batches"),
      getCollection<GrowingProfile>("/api/v1/profiles"),
      getCollection<DashboardData["rules"][number]>("/api/v1/cultivation-rules"),
      calendarPromise,
      getCollection<PlantingEvent>("/api/v1/plantings"),
      getCollection<JournalEntry>("/api/v1/journal"),
    ]);

  return { species, varieties, seedBatches, profiles, rules, calendar, plantings, journal };
}

export function createSpecies(input: {
  commonName: string;
  latinName?: string | null;
  category: Species["category"];
  notes?: string | null;
}) {
  return request<Species>("/api/v1/species", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSpecies(
  speciesId: string,
  input: {
    commonName?: string;
    latinName?: string | null;
    category?: Species["category"];
    notes?: string | null;
  },
) {
  return request<Species>(`/api/v1/species/${speciesId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSpecies(speciesId: string) {
  return request<void>(`/api/v1/species/${speciesId}`, {
    method: "DELETE",
  });
}

export function createVariety(input: {
  speciesId: string;
  name: string;
  description?: string | null;
  heirloom: boolean;
  tags: string[];
  notes?: string | null;
  synonyms: string[];
}) {
  return request<Variety>("/api/v1/varieties", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateVariety(
  varietyId: string,
  input: {
    speciesId?: string;
    name?: string;
    description?: string | null;
    heirloom?: boolean;
    tags?: string[];
    notes?: string | null;
    synonyms?: string[];
  },
) {
  return request<Variety>(`/api/v1/varieties/${varietyId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteVariety(varietyId: string) {
  return request<void>(`/api/v1/varieties/${varietyId}`, {
    method: "DELETE",
  });
}

export function createSeedBatch(input: {
  varietyId: string;
  source?: string | null;
  harvestYear?: number | null;
  quantity: number;
  unit: SeedBatch["unit"];
  storageLocation?: string | null;
  storageTemperatureC?: number | null;
  storageHumidityPercent?: number | null;
  storageLightExposure?: SeedBatch["storageLightExposure"];
  storageMoistureLevel?: SeedBatch["storageMoistureLevel"];
  storageContainer?: string | null;
  storageQualityCheckedAt?: string | null;
  notes?: string | null;
}) {
  return request<SeedBatch>("/api/v1/seed-batches", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSeedBatch(
  seedBatchId: string,
  input: {
    varietyId?: string;
    source?: string | null;
    harvestYear?: number | null;
    storageLocation?: string | null;
    storageTemperatureC?: number | null;
    storageHumidityPercent?: number | null;
    storageLightExposure?: SeedBatch["storageLightExposure"];
    storageMoistureLevel?: SeedBatch["storageMoistureLevel"];
    storageContainer?: string | null;
    storageQualityCheckedAt?: string | null;
    notes?: string | null;
  },
) {
  return request<SeedBatch>(`/api/v1/seed-batches/${seedBatchId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSeedBatch(seedBatchId: string) {
  return request<void>(`/api/v1/seed-batches/${seedBatchId}`, {
    method: "DELETE",
  });
}

export function createGrowingProfile(input: {
  name: string;
  lastFrostDate: string;
  firstFrostDate: string;
  phenologyStage?: string | null;
  phenologyObservedAt?: string | null;
  phenologyNotes?: string | null;
  notes?: string | null;
  isActive: boolean;
}) {
  return request<GrowingProfile>("/api/v1/profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGrowingProfile(
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
  return request<GrowingProfile>(`/api/v1/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteGrowingProfile(profileId: string) {
  return request<void>(`/api/v1/profiles/${profileId}`, {
    method: "DELETE",
  });
}

export function upsertCultivationRule(input: {
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
}) {
  return request<CultivationRule>("/api/v1/cultivation-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCultivationRule(
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
  return request<CultivationRule>(`/api/v1/cultivation-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCultivationRule(ruleId: string) {
  return request<void>(`/api/v1/cultivation-rules/${ruleId}`, {
    method: "DELETE",
  });
}

export function createPlantingEvent(input: {
  varietyId: string;
  seedBatchId?: string | null;
  growingProfileId?: string | null;
  type: PlantingEvent["type"];
  plannedDate?: string | null;
  actualDate?: string | null;
  quantityUsed?: number | null;
  locationNote?: string | null;
  notes?: string | null;
}) {
  return request<PlantingEvent>("/api/v1/plantings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePlantingEvent(
  plantingId: string,
  input: {
    varietyId?: string;
    seedBatchId?: string | null;
    growingProfileId?: string | null;
    type?: PlantingEvent["type"];
    plannedDate?: string | null;
    actualDate?: string | null;
    quantityUsed?: number | null;
    locationNote?: string | null;
    notes?: string | null;
  },
) {
  return request<PlantingEvent>(`/api/v1/plantings/${plantingId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deletePlantingEvent(plantingId: string) {
  return request<void>(`/api/v1/plantings/${plantingId}`, {
    method: "DELETE",
  });
}

export function createJournalEntry(input: {
  varietyId?: string | null;
  seedBatchId?: string | null;
  plantingEventId?: string | null;
  entryType: JournalEntry["entryType"];
  title: string;
  details?: string | null;
  entryDate: string;
  quantity?: number | null;
  unit?: SeedBatch["unit"] | null;
  tags: string[];
}) {
  return request<JournalEntry>("/api/v1/journal", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createGerminationTest(
  seedBatchId: string,
  input: {
    testedAt: string;
    sampleSize: number;
    germinatedCount: number;
    notes?: string | null;
  },
) {
  return request<GerminationTest>(`/api/v1/seed-batches/${seedBatchId}/germination-tests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchSeedBatchTransactions(seedBatchId: string) {
  return getCollection<SeedBatchTransaction>(`/api/v1/seed-batches/${seedBatchId}/transactions`);
}

export function adjustSeedBatchStock(
  seedBatchId: string,
  input: {
    mode: "SET_ABSOLUTE" | "ADJUST_DELTA";
    quantity: number;
    reason: string;
    effectiveDate: string;
  },
) {
  return request<{ seedBatch: SeedBatch; transaction: SeedBatchTransaction }>(
    `/api/v1/seed-batches/${seedBatchId}/transactions`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function reverseSeedBatchTransaction(
  seedBatchId: string,
  transactionId: string,
  input: {
    reason: string;
    effectiveDate: string;
  },
) {
  return request<{ seedBatch: SeedBatch; transaction: SeedBatchTransaction }>(
    `/api/v1/seed-batches/${seedBatchId}/transactions/${transactionId}/reverse`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateProfilePhenology(
  profileId: string,
  input: {
    phenologyStage: string | null;
    phenologyObservedAt?: string | null;
    phenologyNotes?: string | null;
  },
) {
  return request<GrowingProfile>(`/api/v1/profiles/${profileId}/phenology`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function fetchReminderTasks(params?: {
  status?: ReminderTask["status"];
  assignedUserId?: string;
  dueFrom?: string;
  dueTo?: string;
  tag?: string;
}) {
  const search = new URLSearchParams();

  if (params?.status) search.set("status", params.status);
  if (params?.assignedUserId) search.set("assignedUserId", params.assignedUserId);
  if (params?.dueFrom) search.set("dueFrom", params.dueFrom);
  if (params?.dueTo) search.set("dueTo", params.dueTo);
  if (params?.tag) search.set("tag", params.tag);

  const query = search.toString();
  return getCollection<ReminderTask>(`/api/v1/tasks${query ? `?${query}` : ""}`);
}

export function createReminderTask(input: {
  assignedUserId?: string | null;
  varietyId?: string | null;
  seedBatchId?: string | null;
  plantingEventId?: string | null;
  title: string;
  details?: string | null;
  dueDate: string;
  source?: ReminderTask["source"];
  tags: string[];
}) {
  return request<ReminderTask>("/api/v1/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateReminderTask(taskId: string, status: ReminderTask["status"]) {
  return request<ReminderTask>(`/api/v1/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchTimeline(limit = 50) {
  return getCollection<TimelineItem>(`/api/v1/timeline?limit=${limit}`);
}

export function fetchWorkspaceExport() {
  return request<unknown>("/api/v1/exports/workspace", { method: "GET" });
}

export function fetchBackupSummary() {
  return request<unknown>("/api/v1/backups/summary", { method: "GET" });
}

export function fetchApiTokens() {
  return getCollection<ApiToken>("/api/v1/admin/api-tokens");
}

export function createApiToken(input: {
  name: string;
  scopes: ApiToken["scopes"];
  expiresInDays?: number | null;
  rateLimitPerMinute?: number | null;
}) {
  return request<{ token: string; record: ApiToken }>("/api/v1/admin/api-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeApiToken(tokenId: string) {
  return request<ApiToken>(`/api/v1/admin/api-tokens/${tokenId}/revoke`, {
    method: "POST",
  });
}
