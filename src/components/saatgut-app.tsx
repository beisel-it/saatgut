"use client";

import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n-provider";
import {
  adjustSeedBatchStock,
  ApiClientError,
  createGrowingProfile,
  createGerminationTest,
  createPlantingEvent,
  createSeedBatch,
  createSpecies,
  createVariety,
  fetchDashboardData,
  getSession,
  loginUser,
  logoutUser,
  registerUser,
  reverseSeedBatchTransaction,
  updateProfilePhenology,
  upsertCultivationRule,
} from "@/lib/client/api";
import { getIntlLocale, type AppMessages, type Locale } from "@/lib/i18n";
import type {
  CalendarItem,
  DashboardData,
  GrowingProfile,
  SeedBatch,
  SeedBatchTransaction,
  SeedBatchWarning,
  SessionSnapshot,
  Species,
  Variety,
} from "@/lib/client/types";

type AuthMode = "login" | "register";
type ViewId = "dashboard" | "catalog" | "profiles" | "rules" | "plantings" | "sheets";

type FormState = {
  error: string | null;
  success: string | null;
  fieldErrors: Record<string, string[] | undefined>;
};

type RuleFormValues = {
  varietyId: string;
  sowIndoorsStartWeeks: string;
  sowIndoorsEndWeeks: string;
  sowOutdoorsStartWeeks: string;
  sowOutdoorsEndWeeks: string;
  transplantStartWeeks: string;
  transplantEndWeeks: string;
  harvestStartDays: string;
  harvestEndDays: string;
  spacingCm: string;
  successionIntervalDays: string;
};

const initialFormState: FormState = {
  error: null,
  success: null,
  fieldErrors: {},
};

const speciesCategories: Species["category"][] = [
  "VEGETABLE",
  "FRUIT",
  "HERB",
  "FLOWER",
  "OTHER",
];

const seedUnits = ["SEEDS", "PACKETS", "GRAMS"] as const;
const plantingTypes = ["SOW_INDOORS", "SOW_OUTDOORS", "TRANSPLANT", "HARVEST"] as const;
const phenologyStageIds = [
  "late-winter",
  "first-spring",
  "full-spring",
  "early-summer",
  "high-summer",
  "late-summer",
  "early-autumn",
] as const;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function formatDate(value: string | null, locale: Locale, fallback: string) {
  if (!value) return fallback;
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCalendarDate(item: CalendarItem, locale: Locale, fallback: string) {
  if (item.kind === "window") return formatDate(item.recommendedDate, locale, fallback);
  if (item.kind === "recorded") return formatDate(item.date, locale, fallback);
  return formatDate(item.dateStart, locale, fallback);
}

function labelPlantingType(value: string, t: AppMessages) {
  return t.enums.plantingType[value as keyof typeof t.enums.plantingType] ?? value;
}

function labelMembershipRole(value: string, t: AppMessages) {
  return t.membershipRoles[value as keyof typeof t.membershipRoles] ?? value;
}

function labelSpeciesCategory(value: Species["category"], t: AppMessages) {
  return t.enums.speciesCategory[value];
}

function labelSeedUnit(value: (typeof seedUnits)[number], t: AppMessages) {
  return t.enums.seedUnit[value];
}

function getWarningTitle(code: string, fallback: string, t: AppMessages) {
  return t.warningTitles[code as keyof typeof t.warningTitles] ?? fallback;
}

function summarizeCalendarItem(item: CalendarItem, locale: Locale, t: AppMessages) {
  if (item.kind === "window") {
    return `${item.speciesName} · ${formatDate(item.windowStart, locale, t.common.notSet)} ${t.calendar.rangeSeparator} ${formatDate(item.windowEnd, locale, t.common.notSet)}`;
  }

  if (item.kind === "recorded") {
    return `${labelPlantingType(item.event.type, t)} ${t.calendar.recordedSuffix}`;
  }

  return item.dateEnd
    ? `${formatDate(item.dateStart, locale, t.common.notSet)} ${t.calendar.rangeSeparator} ${formatDate(item.dateEnd, locale, t.common.notSet)}`
    : formatDate(item.dateStart, locale, t.common.notSet);
}

function toFormState(error: unknown, t: AppMessages): FormState {
  if (error instanceof ApiClientError) {
    return {
      error: t.apiErrors[error.code as keyof typeof t.apiErrors] ?? error.message,
      success: null,
      fieldErrors: error.fieldErrors,
    };
  }

  return {
    error: error instanceof Error ? error.message : t.statuses.genericError,
    success: null,
    fieldErrors: {},
  };
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function nullableRange(start: number | null, end: number | null, suffix: string, fallback = "") {
  if (start === null && end === null) return fallback;
  if (start !== null && end !== null) return `${start}–${end} ${suffix}`;
  return `${start ?? end} ${suffix}`;
}

function formatNumber(value: string | number | null | undefined, locale: Locale, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) return String(value);

  return new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function formatSeedQuantity(
  value: string | null,
  unit: SeedBatch["unit"],
  locale: Locale,
  t: AppMessages,
  fallback: string,
) {
  if (!value) return fallback;
  return `${formatNumber(value, locale, fallback)} ${labelSeedUnit(unit, t).toLowerCase()}`;
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function normalizeLookupValue(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
}

function inferPacketNames(packetLabel: string) {
  const trimmed = packetLabel.trim();
  const cleaned = trimmed.replace(/\s+/g, " ");
  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { speciesName: "", varietyName: "" };
  }

  if (parts.length === 1) {
    return { speciesName: parts[0], varietyName: parts[0] };
  }

  const speciesName = parts[parts.length - 1];
  const varietyName = parts.slice(0, -1).join(" ");

  return { speciesName, varietyName: varietyName || cleaned };
}

export function SaatgutApp() {
  const { locale, setLocale, t } = useI18n();
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [view, setView] = useState<ViewId>("dashboard");
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<FormState>(initialFormState);
  const [packetIntakeState, setPacketIntakeState] = useState<FormState>(initialFormState);
  const [speciesState, setSpeciesState] = useState<FormState>(initialFormState);
  const [varietyState, setVarietyState] = useState<FormState>(initialFormState);
  const [seedBatchState, setSeedBatchState] = useState<FormState>(initialFormState);
  const [profileState, setProfileState] = useState<FormState>(initialFormState);
  const [ruleState, setRuleState] = useState<FormState>(initialFormState);
  const [plantingState, setPlantingState] = useState<FormState>(initialFormState);
  const [germinationState, setGerminationState] = useState<FormState>(initialFormState);
  const [correctionState, setCorrectionState] = useState<FormState>(initialFormState);

  const [authPending, startAuthTransition] = useTransition();
  const [refreshPending, startRefreshTransition] = useTransition();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    workspaceName: "",
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [speciesForm, setSpeciesForm] = useState({
    commonName: "",
    latinName: "",
    category: "VEGETABLE" as Species["category"],
    notes: "",
  });
  const [packetIntakeForm, setPacketIntakeForm] = useState({
    packetName: "",
    quantity: "",
    unit: "PACKETS" as (typeof seedUnits)[number],
    source: "",
    harvestYear: "",
    storageLocation: "",
    notes: "",
  });
  const [varietyForm, setVarietyForm] = useState({
    speciesId: "",
    name: "",
    description: "",
    heirloom: false,
    tags: "",
    notes: "",
    synonyms: "",
  });
  const [seedBatchForm, setSeedBatchForm] = useState({
    varietyId: "",
    source: "",
    harvestYear: "",
    quantity: "",
    unit: "SEEDS" as (typeof seedUnits)[number],
    storageLocation: "",
    notes: "",
  });
  const [profileForm, setProfileForm] = useState({
    name: "",
    lastFrostDate: "",
    firstFrostDate: "",
    notes: "",
    isActive: true,
  });
  const [ruleForm, setRuleForm] = useState<RuleFormValues>({
    varietyId: "",
    sowIndoorsStartWeeks: "",
    sowIndoorsEndWeeks: "",
    sowOutdoorsStartWeeks: "",
    sowOutdoorsEndWeeks: "",
    transplantStartWeeks: "",
    transplantEndWeeks: "",
    harvestStartDays: "",
    harvestEndDays: "",
    spacingCm: "",
    successionIntervalDays: "",
  });
  const [plantingForm, setPlantingForm] = useState({
    varietyId: "",
    seedBatchId: "",
    growingProfileId: "",
    type: "SOW_INDOORS" as (typeof plantingTypes)[number],
    plannedDate: "",
    actualDate: "",
    quantityUsed: "",
    locationNote: "",
    notes: "",
  });
  const [germinationForm, setGerminationForm] = useState({
    seedBatchId: "",
    entryDate: "",
    sampleSize: "",
    germinatedCount: "",
    notes: "",
  });
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<Species["category"] | "ALL">("ALL");
  const [catalogView, setCatalogView] = useState<"ALL" | "ON_HAND" | "ATTENTION">("ALL");
  const [catalogToolsOpen, setCatalogToolsOpen] = useState(false);
  const [printScope, setPrintScope] = useState<"ALL" | "DIGEST" | "VARIETIES" | "BATCHES">("ALL");
  const [printOnlyStocked, setPrintOnlyStocked] = useState(true);
  const [printIncludeNotes, setPrintIncludeNotes] = useState(true);
  const [correctionForm, setCorrectionForm] = useState({
    seedBatchId: "",
    entryDate: "",
    mode: "ADJUST_DELTA" as "SET_ABSOLUTE" | "ADJUST_DELTA",
    quantity: "",
    reason: "",
  });
  const [reversalForm, setReversalForm] = useState({
    seedBatchId: "",
    transactionId: "",
    entryDate: "",
    reason: "",
  });
  const deferredCatalogQuery = useDeferredValue(catalogQuery);

  async function loadDashboard() {
    const data = await fetchDashboardData();
    setDashboard(data);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const nextSession = await getSession();
        if (cancelled) return;

        setSession(nextSession);
        await loadDashboard();
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiClientError && error.status === 401) {
          setSession(null);
          setDashboard(null);
        } else {
          setSessionError(error instanceof Error ? error.message : t.statuses.sessionLoadFailed);
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [t.statuses.sessionLoadFailed]);

  const activeProfile = useMemo(
    () => dashboard?.profiles.find((profile) => profile.isActive) ?? null,
    [dashboard],
  );

  const varietiesById = useMemo(
    () => new Map((dashboard?.varieties ?? []).map((variety) => [variety.id, variety])),
    [dashboard?.varieties],
  );

  const seedBatchesForSelectedVariety = useMemo(
    () =>
      (dashboard?.seedBatches ?? []).filter(
        (seedBatch) => !plantingForm.varietyId || seedBatch.varietyId === plantingForm.varietyId,
      ),
    [dashboard?.seedBatches, plantingForm.varietyId],
  );

  const storageWarningsByBatch = useMemo(
    () => new Map((dashboard?.seedBatches ?? []).map((seedBatch) => [seedBatch.id, seedBatch.storageWarnings ?? []])),
    [dashboard?.seedBatches],
  );

  const criticalBatchCount = useMemo(
    () =>
      Array.from(storageWarningsByBatch.values()).filter((warnings) =>
        warnings.some((warning) => warning.level === "critical"),
      ).length,
    [storageWarningsByBatch],
  );

  const catalogEntries = useMemo(() => {
    const normalizedQuery = deferredCatalogQuery.trim().toLowerCase();

    return (dashboard?.varieties ?? [])
      .map((variety) => {
        const species =
          variety.species ?? (dashboard?.species ?? []).find((entry) => entry.id === variety.speciesId) ?? null;
        const seedBatches = (dashboard?.seedBatches ?? [])
          .filter((seedBatch) => seedBatch.varietyId === variety.id)
          .sort((left, right) => {
            const leftValue = left.harvestYear ?? 0;
            const rightValue = right.harvestYear ?? 0;
            return rightValue - leftValue;
          });
        const warnings = seedBatches.flatMap((seedBatch) =>
          (storageWarningsByBatch.get(seedBatch.id) ?? []).filter((warning) => warning.level !== "info"),
        );
        const latestTest = seedBatches
          .flatMap((seedBatch) => seedBatch.germinationTests ?? [])
          .sort((left, right) => new Date(right.testedAt).getTime() - new Date(left.testedAt).getTime())[0] ?? null;
        const searchText = [
          variety.name,
          variety.description,
          variety.notes,
          species?.commonName,
          species?.latinName,
          ...(variety.tags ?? []),
          ...((variety.synonyms ?? []).map((synonym) => synonym.name)),
          ...seedBatches.flatMap((seedBatch) => [seedBatch.source, seedBatch.storageLocation, seedBatch.notes]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
        const matchesCategory = catalogCategory === "ALL" || species?.category === catalogCategory;
        const matchesView =
          catalogView === "ALL" ||
          (catalogView === "ON_HAND" ? seedBatches.length > 0 : warnings.length > 0);

        return {
          variety,
          species,
          seedBatches,
          warnings,
          latestTest,
          matchesQuery,
          matchesCategory,
          matchesView,
        };
      })
      .filter((entry) => entry.matchesQuery && entry.matchesCategory && entry.matchesView)
      .sort((left, right) => left.variety.name.localeCompare(right.variety.name));
  }, [
    catalogCategory,
    catalogView,
    dashboard?.seedBatches,
    dashboard?.species,
    dashboard?.varieties,
    deferredCatalogQuery,
    storageWarningsByBatch,
  ]);

  const printableCatalogEntries = useMemo(() => {
    const entries = (dashboard?.varieties ?? [])
      .map((variety) => {
        const species =
          variety.species ?? (dashboard?.species ?? []).find((entry) => entry.id === variety.speciesId) ?? null;
        const seedBatches = (dashboard?.seedBatches ?? [])
          .filter((seedBatch) => seedBatch.varietyId === variety.id)
          .sort((left, right) => {
            const leftValue = left.harvestYear ?? 0;
            const rightValue = right.harvestYear ?? 0;
            return rightValue - leftValue;
          });
        const warnings = seedBatches.flatMap((seedBatch) => storageWarningsByBatch.get(seedBatch.id) ?? []);
        const latestTest = seedBatches
          .flatMap((seedBatch) => seedBatch.germinationTests ?? [])
          .sort((left, right) => new Date(right.testedAt).getTime() - new Date(left.testedAt).getTime())[0] ?? null;

        return {
          variety,
          species,
          seedBatches,
          warnings,
          latestTest,
        };
      })
      .filter((entry) => (printOnlyStocked ? entry.seedBatches.length > 0 : true))
      .sort((left, right) => left.variety.name.localeCompare(right.variety.name));

    return entries;
  }, [dashboard?.seedBatches, dashboard?.species, dashboard?.varieties, printOnlyStocked, storageWarningsByBatch]);

  const printableVarietyPages = useMemo(() => chunkArray(printableCatalogEntries, 2), [printableCatalogEntries]);

  const printableBatchCards = useMemo(
    () =>
      printableCatalogEntries.flatMap((entry) =>
        entry.seedBatches.map((seedBatch) => ({
          seedBatch,
          variety: entry.variety,
          species: entry.species,
          warnings: storageWarningsByBatch.get(seedBatch.id) ?? [],
          latestTest:
            [...(seedBatch.germinationTests ?? [])].sort(
              (left, right) => new Date(right.testedAt).getTime() - new Date(left.testedAt).getTime(),
            )[0] ?? null,
          latestAdjustment:
            [...(seedBatch.stockTransactions ?? [])]
              .filter((transaction) => transaction.type !== "INITIAL_STOCK")
              .sort(
                (left, right) =>
                  new Date(right.effectiveDate).getTime() - new Date(left.effectiveDate).getTime(),
              )[0] ?? null,
        })),
      ),
    [printableCatalogEntries, storageWarningsByBatch],
  );

  const printableBatchPages = useMemo(() => chunkArray(printableBatchCards, 4), [printableBatchCards]);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthState(initialFormState);

    startAuthTransition(() => {
      void registerUser({
        email: registerForm.email,
        password: registerForm.password,
        workspaceName: registerForm.workspaceName || undefined,
      })
        .then(async (result) => {
          setSession(result);
          await loadDashboard();
        })
        .catch((error) => setAuthState(toFormState(error, t)));
    });
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthState(initialFormState);

    startAuthTransition(() => {
      void loginUser(loginForm)
        .then(async (result) => {
          setSession(result);
          await loadDashboard();
        })
        .catch((error) => setAuthState(toFormState(error, t)));
    });
  }

  async function handleLogout() {
    setSessionError(null);
    setMobileNavOpen(false);

    startAuthTransition(() => {
      void logoutUser()
        .then(() => {
          setSession(null);
          setDashboard(null);
          setView("dashboard");
        })
        .catch((error) =>
          setSessionError(error instanceof Error ? error.message : t.statuses.logoutFailed),
        );
    });
  }

  function handlePrint() {
    window.print();
  }

  function handleSelectView(nextView: ViewId) {
    setView(nextView);
    setMobileNavOpen(false);
  }

  async function submitSpecies(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSpeciesState(initialFormState);

    try {
      await createSpecies({
        commonName: speciesForm.commonName,
        latinName: speciesForm.latinName || null,
        category: speciesForm.category,
        notes: speciesForm.notes || null,
      });
      setSpeciesForm({
        commonName: "",
        latinName: "",
        category: "VEGETABLE",
        notes: "",
      });
      setSpeciesState({ error: null, success: t.statuses.speciesSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setSpeciesState(toFormState(error, t));
    }
  }

  async function submitVariety(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVarietyState(initialFormState);

    try {
      await createVariety({
        speciesId: varietyForm.speciesId,
        name: varietyForm.name,
        description: varietyForm.description || null,
        heirloom: varietyForm.heirloom,
        tags: parseTags(varietyForm.tags),
        notes: varietyForm.notes || null,
        synonyms: parseTags(varietyForm.synonyms),
      });
      setVarietyForm({
        speciesId: "",
        name: "",
        description: "",
        heirloom: false,
        tags: "",
        notes: "",
        synonyms: "",
      });
      setVarietyState({ error: null, success: t.statuses.varietySaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setVarietyState(toFormState(error, t));
    }
  }

  async function submitSeedBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSeedBatchState(initialFormState);

    try {
      await createSeedBatch({
        varietyId: seedBatchForm.varietyId,
        source: seedBatchForm.source || null,
        harvestYear: seedBatchForm.harvestYear ? Number(seedBatchForm.harvestYear) : null,
        quantity: Number(seedBatchForm.quantity),
        unit: seedBatchForm.unit,
        storageLocation: seedBatchForm.storageLocation || null,
        notes: seedBatchForm.notes || null,
      });
      setSeedBatchForm({
        varietyId: "",
        source: "",
        harvestYear: "",
        quantity: "",
        unit: "SEEDS",
        storageLocation: "",
        notes: "",
      });
      setSeedBatchState({ error: null, success: t.statuses.seedBatchSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setSeedBatchState(toFormState(error, t));
    }
  }

  async function submitPacketIntake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPacketIntakeState(initialFormState);

    try {
      const packetLabel = packetIntakeForm.packetName.trim();
      const inferred = inferPacketNames(packetLabel);
      const normalizedPacket = normalizeLookupValue(packetLabel);
      const normalizedSpecies = normalizeLookupValue(inferred.speciesName);
      const normalizedVariety = normalizeLookupValue(inferred.varietyName);

      let species =
        (dashboard?.species ?? []).find(
          (entry) =>
            normalizeLookupValue(entry.commonName) === normalizedSpecies ||
            normalizeLookupValue(entry.latinName) === normalizedSpecies,
        ) ?? null;

      if (!species) {
        species = await createSpecies({
          commonName: inferred.speciesName || packetLabel,
          latinName: null,
          category: "VEGETABLE",
          notes: null,
        });
      }

      let variety =
        (dashboard?.varieties ?? []).find((entry) => {
          const synonyms = (entry.synonyms ?? []).map((synonym) => normalizeLookupValue(synonym.name));
          return (
            normalizeLookupValue(entry.name) === normalizedVariety ||
            normalizeLookupValue(entry.name) === normalizedPacket ||
            synonyms.includes(normalizedVariety) ||
            synonyms.includes(normalizedPacket)
          );
        }) ?? null;

      if (!variety) {
        variety = await createVariety({
          speciesId: species.id,
          name: inferred.varietyName || packetLabel,
          description: null,
          heirloom: false,
          tags: [],
          notes: null,
          synonyms: normalizedVariety !== normalizedPacket && packetLabel ? [packetLabel] : [],
        });
      }

      await createSeedBatch({
        varietyId: variety.id,
        source: packetIntakeForm.source || null,
        harvestYear: packetIntakeForm.harvestYear ? Number(packetIntakeForm.harvestYear) : null,
        quantity: Number(packetIntakeForm.quantity),
        unit: packetIntakeForm.unit,
        storageLocation: packetIntakeForm.storageLocation || null,
        notes: packetIntakeForm.notes || null,
      });

      setPacketIntakeForm({
        packetName: "",
        quantity: "",
        unit: "PACKETS",
        source: "",
        harvestYear: "",
        storageLocation: "",
        notes: "",
      });
      setPacketIntakeState({ error: null, success: t.catalog.intakeSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setPacketIntakeState(toFormState(error, t));
    }
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileState(initialFormState);

    try {
      await createGrowingProfile({
        name: profileForm.name,
        lastFrostDate: toIsoDate(profileForm.lastFrostDate),
        firstFrostDate: toIsoDate(profileForm.firstFrostDate),
        phenologyStage: null,
        phenologyObservedAt: null,
        phenologyNotes: null,
        notes: profileForm.notes || null,
        isActive: profileForm.isActive,
      });

      setProfileForm({
        name: "",
        lastFrostDate: "",
        firstFrostDate: "",
        notes: "",
        isActive: true,
      });
      setProfileState({ error: null, success: t.statuses.profileSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setProfileState(toFormState(error, t));
    }
  }

  async function submitRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuleState(initialFormState);

    try {
      await upsertCultivationRule({
        varietyId: ruleForm.varietyId,
        sowIndoorsStartWeeks: ruleForm.sowIndoorsStartWeeks ? Number(ruleForm.sowIndoorsStartWeeks) : null,
        sowIndoorsEndWeeks: ruleForm.sowIndoorsEndWeeks ? Number(ruleForm.sowIndoorsEndWeeks) : null,
        sowOutdoorsStartWeeks: ruleForm.sowOutdoorsStartWeeks ? Number(ruleForm.sowOutdoorsStartWeeks) : null,
        sowOutdoorsEndWeeks: ruleForm.sowOutdoorsEndWeeks ? Number(ruleForm.sowOutdoorsEndWeeks) : null,
        transplantStartWeeks: ruleForm.transplantStartWeeks ? Number(ruleForm.transplantStartWeeks) : null,
        transplantEndWeeks: ruleForm.transplantEndWeeks ? Number(ruleForm.transplantEndWeeks) : null,
        harvestStartDays: ruleForm.harvestStartDays ? Number(ruleForm.harvestStartDays) : null,
        harvestEndDays: ruleForm.harvestEndDays ? Number(ruleForm.harvestEndDays) : null,
        spacingCm: ruleForm.spacingCm ? Number(ruleForm.spacingCm) : null,
        successionIntervalDays: ruleForm.successionIntervalDays
          ? Number(ruleForm.successionIntervalDays)
          : null,
      });
      setRuleState({ error: null, success: t.statuses.cultivationRuleSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setRuleState(toFormState(error, t));
    }
  }

  async function submitPlanting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPlantingState(initialFormState);

    try {
      await createPlantingEvent({
        varietyId: plantingForm.varietyId,
        seedBatchId: plantingForm.seedBatchId || null,
        growingProfileId: plantingForm.growingProfileId || null,
        type: plantingForm.type,
        plannedDate: plantingForm.plannedDate ? toIsoDate(plantingForm.plannedDate) : null,
        actualDate: plantingForm.actualDate ? toIsoDate(plantingForm.actualDate) : null,
        quantityUsed: plantingForm.quantityUsed ? Number(plantingForm.quantityUsed) : null,
        locationNote: plantingForm.locationNote || null,
        notes: plantingForm.notes || null,
      });
      setPlantingForm({
        varietyId: "",
        seedBatchId: "",
        growingProfileId: "",
        type: "SOW_INDOORS",
        plannedDate: "",
        actualDate: "",
        quantityUsed: "",
        locationNote: "",
        notes: "",
      });
      setPlantingState({ error: null, success: t.statuses.plantingSaved, fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setPlantingState(toFormState(error, t));
    }
  }

  async function submitGermination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGerminationState(initialFormState);

    try {
      await createGerminationTest(germinationForm.seedBatchId, {
        testedAt: toIsoDate(germinationForm.entryDate),
        sampleSize: Number(germinationForm.sampleSize),
        germinatedCount: Number(germinationForm.germinatedCount),
        notes: germinationForm.notes || null,
      });
      setGerminationForm({
        seedBatchId: "",
        entryDate: "",
        sampleSize: "",
        germinatedCount: "",
        notes: "",
      });
      setGerminationState({
        error: null,
        success: t.statuses.germinationLogged,
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setGerminationState(toFormState(error, t));
    }
  }

  async function submitCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCorrectionState(initialFormState);

    try {
      await adjustSeedBatchStock(correctionForm.seedBatchId, {
        mode: correctionForm.mode,
        quantity: Number(correctionForm.quantity),
        reason: correctionForm.reason,
        effectiveDate: toIsoDate(correctionForm.entryDate),
      });
      setCorrectionForm({
        seedBatchId: "",
        entryDate: "",
        mode: "ADJUST_DELTA",
        quantity: "",
        reason: "",
      });
      setCorrectionState({
        error: null,
        success: t.statuses.stockCorrectionApplied,
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setCorrectionState(toFormState(error, t));
    }
  }

  async function submitReversal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCorrectionState(initialFormState);

    try {
      await reverseSeedBatchTransaction(reversalForm.seedBatchId, reversalForm.transactionId, {
        reason: reversalForm.reason,
        effectiveDate: toIsoDate(reversalForm.entryDate),
      });
      setReversalForm({
        seedBatchId: "",
        transactionId: "",
        entryDate: "",
        reason: "",
      });
      setCorrectionState({
        error: null,
        success: t.statuses.stockReversalApplied,
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setCorrectionState(toFormState(error, t));
    }
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(127,155,71,0.18),transparent_30%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-xl border border-[var(--border)] bg-white/70 p-10 shadow-[var(--shadow)]">
          <BrandLockup variant="transparent" className="h-12 w-auto" priority />
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{t.common.loadingWorkspace}</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,155,71,0.22),transparent_32%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-8 shadow-[var(--shadow)] md:p-10">
            <div className="space-y-6">
              <BrandLockup variant="transparent" className="h-14 w-auto md:h-16" priority />
              <ScreenHeader
                eyebrow=""
                title={t.auth.heroTitle}
                subtitle={t.auth.heroSubtitle}
                supportingCopy={t.auth.heroCopy}
                titleClassName="max-w-[18ch] md:max-w-[19ch]"
              />
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(24,49,40,0.94)] p-6 text-white shadow-[var(--shadow)] md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-full flex-wrap rounded-lg bg-white/10 p-1 text-sm sm:w-auto">
                <button
                  type="button"
                  className={classNames(
                    "min-w-0 flex-1 rounded-md px-3 py-2 transition sm:flex-none",
                    locale === "de" && "bg-white text-[var(--foreground)]",
                  )}
                  onClick={() => setLocale("de")}
                >
                  {t.locale.de}
                </button>
                <button
                  type="button"
                  className={classNames(
                    "min-w-0 flex-1 rounded-md px-3 py-2 transition sm:flex-none",
                    locale === "en" && "bg-white text-[var(--foreground)]",
                  )}
                  onClick={() => setLocale("en")}
                >
                  {t.locale.en}
                </button>
              </div>
              <span className="text-xs uppercase tracking-[0.24em] text-white/60">{t.locale.switchLabel}</span>
            </div>
            <div className="mt-6 flex w-full flex-wrap rounded-lg bg-white/10 p-1 text-sm">
              <button
                type="button"
                className={classNames(
                  "min-w-0 flex-1 rounded-md px-4 py-2 transition",
                  authMode === "register" && "bg-white text-[var(--foreground)]",
                )}
                onClick={() => {
                  setAuthMode("register");
                  setAuthState(initialFormState);
                }}
              >
                {t.auth.createWorkspaceTab}
              </button>
              <button
                type="button"
                className={classNames(
                  "min-w-0 flex-1 rounded-md px-4 py-2 transition",
                  authMode === "login" && "bg-white text-[var(--foreground)]",
                )}
                onClick={() => {
                  setAuthMode("login");
                  setAuthState(initialFormState);
                }}
              >
                {t.auth.signInTab}
              </button>
            </div>

            <div className="mt-6">
              <h2 className="max-w-[18ch] text-2xl font-semibold tracking-tight text-balance">
                {authMode === "register" ? t.auth.registerTitle : t.auth.loginTitle}
              </h2>
              <p className="mt-2 max-w-[38ch] text-sm leading-6 text-white/72">
                {authMode === "register" ? t.auth.registerSubtitle : t.auth.loginSubtitle}
              </p>
            </div>

            {sessionError ? <Alert tone="danger">{sessionError}</Alert> : null}
            {authState.error ? <Alert tone="danger">{authState.error}</Alert> : null}

            {authMode === "register" ? (
              <form className="mt-6 grid gap-4" onSubmit={handleRegister}>
                <Field label={t.auth.email} name="email" fieldErrors={authState.fieldErrors} optionalLabel={t.common.optional} tone="inverse">
                  <input
                    className="field-input-dark"
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </Field>
                <Field label={t.auth.password} name="password" fieldErrors={authState.fieldErrors} optionalLabel={t.common.optional} tone="inverse">
                  <input
                    className="field-input-dark"
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </Field>
                <Field label={t.auth.workspaceName} name="workspaceName" fieldErrors={authState.fieldErrors} optional optionalLabel={t.common.optional} tone="inverse">
                  <input
                    className="field-input-dark"
                    type="text"
                    value={registerForm.workspaceName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        workspaceName: event.target.value,
                      }))
                    }
                  />
                </Field>
                <button className="w-full rounded-lg bg-white px-5 py-3 font-semibold text-[var(--foreground)] sm:w-fit" disabled={authPending}>
                  {authPending ? t.auth.creatingWorkspace : t.auth.createWorkspace}
                </button>
              </form>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
                <Field label={t.auth.email} name="email" fieldErrors={authState.fieldErrors} optionalLabel={t.common.optional} tone="inverse">
                  <input
                    className="field-input-dark"
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </Field>
                <Field label={t.auth.password} name="password" fieldErrors={authState.fieldErrors} optionalLabel={t.common.optional} tone="inverse">
                  <input
                    className="field-input-dark"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </Field>
                <button className="w-full rounded-lg bg-white px-5 py-3 font-semibold text-[var(--foreground)] sm:w-fit" disabled={authPending}>
                  {authPending ? t.auth.signingIn : t.auth.signIn}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  const dashboardCalendarStats = [{ label: t.stats.items14Days, value: dashboard?.calendar.length ?? 0 }];
  const dashboardQualityStats = [
    { label: t.stats.seedBatches, value: dashboard?.seedBatches.length ?? 0 },
    {
      label: t.stats.qualitySignals,
      value: (dashboard?.seedBatches ?? []).reduce(
        (sum, seedBatch) =>
          sum +
          (seedBatch.germinationTests?.length ? 1 : 0) +
          ((seedBatch.stockTransactions?.filter((transaction) => transaction.type !== "INITIAL_STOCK").length ?? 0) > 0 ? 1 : 0),
        0,
      ),
    },
    { label: t.stats.criticalStorageFlags, value: criticalBatchCount },
  ];
  const navigationItems: Array<[ViewId, string]> = [
    ["dashboard", t.nav.dashboard],
    ["catalog", t.nav.catalog],
    ["profiles", t.nav.profiles],
    ["rules", t.nav.rules],
    ["plantings", t.nav.plantings],
    ["sheets", t.nav.sheets],
  ];
  const showDashboardHero = view === "dashboard";

  return (
    <main className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(127,155,71,0.18),transparent_28%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-4 py-4 md:px-6 md:py-6 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto grid min-w-0 max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="print-hide hidden rounded-xl border border-[var(--border)] bg-[color:rgba(24,49,40,0.96)] p-5 text-white shadow-[var(--shadow)] lg:sticky lg:top-4 lg:block lg:self-start">
          <div className="flex items-center gap-3">
            <BrandLockup variant="inverted" className="h-11 w-auto" />
          </div>
          <h1 className="mt-4 max-w-full break-words text-2xl font-semibold tracking-tight md:text-3xl">{session.membership.workspace.name}</h1>
          <p className="mt-2 break-all text-sm text-white/70">
            {session.user.email} · {labelMembershipRole(session.membership.role, t)}
          </p>

          <nav className="mt-8 grid gap-2">
            {navigationItems.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectView(id)}
                className={classNames(
                  "rounded-lg px-4 py-3 text-left text-sm font-medium leading-6 transition",
                  view === id ? "bg-white text-[var(--foreground)]" : "bg-white/6 text-white/84 hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">{t.dashboard.activeProfile}</p>
            <p className="mt-2 text-lg font-semibold">{activeProfile ? activeProfile.name : t.dashboard.noActiveProfile}</p>
            <p className="mt-1 text-sm text-white/68">
              {activeProfile
                ? `${t.dashboard.lastFrost} ${formatDate(activeProfile.lastFrostDate, locale, t.common.notSet)}`
                : t.dashboard.createActiveProfile}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 w-full rounded-lg border border-white/14 px-4 py-3 text-sm font-semibold text-white/88"
            disabled={authPending}
          >
            {authPending ? t.common.signingOut : t.common.signOut}
          </button>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="print-hide sticky top-3 z-30 lg:hidden">
            <div className="relative rounded-xl border border-[var(--border)] bg-[color:rgba(24,49,40,0.96)] p-3 text-white shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-3 pr-1">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandIcon className="h-10 w-10 shrink-0 overflow-hidden rounded-md" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/78">
                      Saatgut
                    </p>
                    <h1 className="mt-1 truncate text-lg font-semibold tracking-tight">{session.membership.workspace.name}</h1>
                  </div>
                </div>
                <button
                  type="button"
                  aria-expanded={mobileNavOpen}
                  aria-label={mobileNavOpen ? t.common.closeNavigation : t.common.openNavigation}
                  onClick={() => setMobileNavOpen((current) => !current)}
                  className="shrink-0 rounded-md border border-white/14 bg-white/8 px-3 py-2 text-sm font-semibold text-white"
                >
                  {mobileNavOpen ? t.common.closeNavigation : t.common.menu}
                </button>
              </div>

              {mobileNavOpen ? (
                <div className="absolute inset-x-0 top-full mt-3 rounded-xl border border-[var(--border)] bg-[color:rgba(24,49,40,0.98)] p-3 shadow-[var(--shadow)]">
                  <p className="truncate text-sm text-white/68">
                    {session.user.email} · {labelMembershipRole(session.membership.role, t)}
                  </p>

                  <nav className="mt-3 grid grid-cols-2 gap-2">
                    {navigationItems.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectView(id)}
                        className={classNames(
                          "rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                          view === id
                            ? "bg-white text-[var(--foreground)]"
                            : "bg-white/6 text-white/84 hover:bg-white/10",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>

                  <div className="mt-3 rounded-md border border-white/10 bg-white/6 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/52">{t.dashboard.activeProfile}</p>
                    <p className="mt-1 text-sm font-semibold">
                      {activeProfile ? activeProfile.name : t.dashboard.noActiveProfile}
                    </p>
                    <p className="mt-1 text-sm text-white/68">
                      {activeProfile
                        ? `${t.dashboard.lastFrost} ${formatDate(activeProfile.lastFrostDate, locale, t.common.notSet)}`
                        : t.dashboard.createActiveProfile}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-md border border-white/14 px-4 py-2.5 text-sm font-semibold text-white/88"
                    disabled={authPending}
                  >
                    {authPending ? t.common.signingOut : t.common.signOut}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {showDashboardHero ? (
            <header className="print-hide rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-4 shadow-[var(--shadow)] md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <ScreenHeader
                  eyebrow={t.dashboard.heroEyebrow}
                  title={t.dashboard.heroTitle}
                  subtitle={t.dashboard.heroSubtitle}
                  titleClassName="max-w-[28ch]"
                  compact
                />
                <button
                  type="button"
                  onClick={() =>
                    startRefreshTransition(() => {
                      void loadDashboard().catch((error) => {
                        setSessionError(error instanceof Error ? error.message : t.statuses.refreshFailed);
                      });
                    })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-semibold md:w-auto"
                  disabled={refreshPending}
                >
                  {refreshPending ? t.common.refreshing : t.common.refreshWorkspace}
                </button>
              </div>

              {sessionError ? <Alert tone="danger">{sessionError}</Alert> : null}
            </header>
          ) : sessionError ? (
            <Alert tone="danger">{sessionError}</Alert>
          ) : null}

          {view === "dashboard" ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title={t.dashboard.calendarTitle} subtitle={t.dashboard.calendarSubtitle}>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  {dashboardCalendarStats.map((stat) => (
                    <CatalogSummaryCard key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                  <div className="rounded-lg border border-[var(--border)] bg-white/70 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:rgba(24,49,40,0.58)]">
                      {t.dashboard.activeProfile}
                    </p>
                    <p className="mt-2 text-base font-semibold">
                      {activeProfile ? activeProfile.name : t.dashboard.noActiveProfile}
                    </p>
                  </div>
                </div>
                {dashboard?.calendar.length ? (
                  <div className="grid gap-3">
                    {dashboard.calendar.map((item, index) => (
                      <article
                        key={`${item.kind}-${index}`}
                        className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                              {t.dashboard.kind[item.kind]}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold">
                              {item.kind === "window"
                                ? `${t.calendar.windowLabel[item.type]} · ${item.varietyName}`
                                : item.kind === "recorded"
                                  ? `${labelPlantingType(item.event.type, t)} · ${item.varietyName}`
                                  : `${t.calendar.windowLabel[item.type]} · ${item.varietyName}`}
                            </h3>
                          </div>
                          <p className="rounded-md bg-white px-3 py-1 text-sm font-medium">
                            {formatCalendarDate(item, locale, t.common.notSet)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
                          {summarizeCalendarItem(item, locale, t)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t.dashboard.noCalendarTitle}
                    copy={t.dashboard.noCalendarCopy}
                  />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title={t.dashboard.seedQualityTitle} subtitle={t.dashboard.seedQualitySubtitle}>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    {dashboardQualityStats.map((stat) => (
                      <CatalogSummaryCard key={stat.label} label={stat.label} value={stat.value} />
                    ))}
                  </div>
                  {dashboard?.seedBatches.length ? (
                    <div className="grid gap-3">
                      {dashboard.seedBatches.slice(0, 5).map((seedBatch) => {
                        const warnings = storageWarningsByBatch.get(seedBatch.id) ?? [];
                        const variety = varietiesById.get(seedBatch.varietyId);

                        return (
                          <article
                            key={seedBatch.id}
                            className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-base font-semibold">{variety?.name ?? t.common.unknownVariety}</h3>
                              <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold">
                                {warnings.filter((warning) => warning.level !== "info").length} {t.dashboard.flags}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2">
                              {warnings.slice(0, 2).map((warning) => (
                                <WarningPill key={warning.title} level={warning.level}>
                                  {getWarningTitle(warning.code, warning.title, t)}
                                </WarningPill>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title={t.dashboard.noBatchWarningsTitle} copy={t.dashboard.noBatchWarningsCopy} />
                  )}
                </Panel>

                <Panel title={t.dashboard.batchSignalsTitle} subtitle={t.dashboard.batchSignalsSubtitle}>
                  {dashboard?.seedBatches.some(
                    (seedBatch) =>
                      (seedBatch.germinationTests?.length ?? 0) > 0 ||
                      (seedBatch.stockTransactions?.length ?? 0) > 1,
                  ) ? (
                    <div className="grid gap-3">
                      {(dashboard?.seedBatches ?? [])
                        .flatMap((seedBatch) => [
                          ...(seedBatch.germinationTests ?? []).slice(0, 1).map((test) => ({
                            key: test.id,
                            title: `${t.seedBatch.germinationTestsTitle} ${test.germinationRate ?? "?"}%`,
                            subtitle: `${varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback} · ${formatDate(test.testedAt, locale, t.common.notSet)}`,
                          })),
                          ...(seedBatch.stockTransactions ?? [])
                            .filter((transaction) => transaction.type !== "INITIAL_STOCK")
                            .slice(0, 1)
                            .map((transaction) => ({
                              key: transaction.id,
                              title: labelPlantingType(transaction.type, t),
                              subtitle: `${varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback} · ${formatDate(transaction.effectiveDate, locale, t.common.notSet)}`,
                            })),
                        ])
                        .slice(0, 8)
                        .map((entry) => (
                        <article
                          key={entry.key}
                          className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-base font-semibold">{entry.title}</h3>
                          </div>
                          <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">{entry.subtitle}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={t.dashboard.noQualityEntriesTitle}
                      copy={t.dashboard.noQualityEntriesCopy}
                    />
                  )}
                </Panel>
              </div>
            </div>
          ) : null}

          {view === "catalog" ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <ScreenHeader
                    eyebrow={t.catalog.eyebrow}
                    title={t.catalog.heroTitle}
                    subtitle={t.catalog.heroSubtitle}
                    titleClassName="max-w-[22ch]"
                  />
                  <button
                    type="button"
                    onClick={() => setCatalogToolsOpen((current) => !current)}
                    className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold lg:w-auto"
                  >
                    {catalogToolsOpen ? t.catalog.toolsHide : t.catalog.toolsShow}
                  </button>
                </div>
              </section>
              {catalogToolsOpen ? (
                <Panel title={t.catalog.toolsTitle} subtitle={t.catalog.toolsSubtitle}>
                  <div className="grid gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
                      <div className="mb-4">
                        <h3 className="max-w-[22ch] text-lg font-semibold tracking-tight">{t.catalog.intakeTitle}</h3>
                        <p className="mt-2 max-w-[42ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                          {t.catalog.intakeSubtitle}
                        </p>
                      </div>
                      <DataForm state={packetIntakeState} onSubmit={submitPacketIntake} submitLabel={t.catalog.saveSeedBatch}>
                        <Field label={t.catalog.intakePacketLabel} name="packetName" fieldErrors={packetIntakeState.fieldErrors} optionalLabel={t.common.optional}>
                          <input
                            className="field-input"
                            value={packetIntakeForm.packetName}
                            onChange={(event) =>
                              setPacketIntakeForm((current) => ({ ...current, packetName: event.target.value }))
                            }
                            placeholder={t.catalog.intakePacketPlaceholder}
                          />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label={t.forms.quantity} name="quantity" fieldErrors={packetIntakeState.fieldErrors} optionalLabel={t.common.optional}>
                            <input
                              className="field-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={packetIntakeForm.quantity}
                              onChange={(event) =>
                                setPacketIntakeForm((current) => ({ ...current, quantity: event.target.value }))
                              }
                            />
                          </Field>
                          <Field label={t.forms.unit} name="unit" fieldErrors={packetIntakeState.fieldErrors} optionalLabel={t.common.optional}>
                            <select
                              className="field-input"
                              value={packetIntakeForm.unit}
                              onChange={(event) =>
                                setPacketIntakeForm((current) => ({
                                  ...current,
                                  unit: event.target.value as (typeof seedUnits)[number],
                                }))
                              }
                            >
                              {seedUnits.map((unit) => (
                                <option key={unit} value={unit}>
                                  {labelSeedUnit(unit, t)}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label={t.forms.source} name="source" fieldErrors={packetIntakeState.fieldErrors} optional optionalLabel={t.common.optional}>
                            <input
                              className="field-input"
                              value={packetIntakeForm.source}
                              onChange={(event) =>
                                setPacketIntakeForm((current) => ({ ...current, source: event.target.value }))
                              }
                              placeholder={t.catalog.intakeSourcePlaceholder}
                            />
                          </Field>
                          <Field label={t.forms.harvestYear} name="harvestYear" fieldErrors={packetIntakeState.fieldErrors} optional optionalLabel={t.common.optional}>
                            <input
                              className="field-input"
                              type="number"
                              min="1900"
                              max="2100"
                              value={packetIntakeForm.harvestYear}
                              onChange={(event) =>
                                setPacketIntakeForm((current) => ({ ...current, harvestYear: event.target.value }))
                              }
                            />
                          </Field>
                        </div>
                        <Field label={t.forms.storageLocation} name="storageLocation" fieldErrors={packetIntakeState.fieldErrors} optional optionalLabel={t.common.optional}>
                          <input
                            className="field-input"
                            value={packetIntakeForm.storageLocation}
                            onChange={(event) =>
                              setPacketIntakeForm((current) => ({
                                ...current,
                                storageLocation: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t.forms.notes} name="notes" fieldErrors={packetIntakeState.fieldErrors} optional optionalLabel={t.common.optional}>
                          <textarea
                            className="field-input min-h-24"
                            value={packetIntakeForm.notes}
                            onChange={(event) =>
                              setPacketIntakeForm((current) => ({ ...current, notes: event.target.value }))
                            }
                          />
                        </Field>
                        <p className="max-w-[44ch] text-sm leading-6 text-[color:rgba(24,49,40,0.62)]">
                          {t.catalog.intakeCreateHint}
                        </p>
                      </DataForm>
                    </div>

                    <CollapsiblePanel title={t.catalog.intakeAdvancedTitle} actionLabel={t.catalog.advancedOpen}>
                      <div className="mb-4">
                        <p className="max-w-[44ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                          {t.catalog.intakeAdvancedSubtitle}
                        </p>
                      </div>
                      <div className="grid gap-3">
                        <CollapsiblePanel title={t.catalog.speciesToolTitle} actionLabel={t.catalog.toolsOpen}>
                          <DataForm state={speciesState} onSubmit={submitSpecies} submitLabel={t.catalog.saveSpecies}>
                            <Field label={t.forms.commonName} name="commonName" fieldErrors={speciesState.fieldErrors} optionalLabel={t.common.optional}>
                              <input
                                className="field-input"
                                value={speciesForm.commonName}
                                onChange={(event) =>
                                  setSpeciesForm((current) => ({ ...current, commonName: event.target.value }))
                                }
                              />
                            </Field>
                            <Field label={t.forms.latinName} name="latinName" fieldErrors={speciesState.fieldErrors} optional optionalLabel={t.common.optional}>
                              <input
                                className="field-input"
                                value={speciesForm.latinName}
                                onChange={(event) =>
                                  setSpeciesForm((current) => ({ ...current, latinName: event.target.value }))
                                }
                              />
                            </Field>
                            <Field label={t.forms.category} name="category" fieldErrors={speciesState.fieldErrors} optionalLabel={t.common.optional}>
                              <select
                                className="field-input"
                                value={speciesForm.category}
                                onChange={(event) =>
                                  setSpeciesForm((current) => ({
                                    ...current,
                                    category: event.target.value as Species["category"],
                                  }))
                                }
                              >
                                {speciesCategories.map((category) => (
                                  <option key={category} value={category}>
                                    {labelSpeciesCategory(category, t)}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label={t.forms.notes} name="notes" fieldErrors={speciesState.fieldErrors} optional optionalLabel={t.common.optional}>
                              <textarea
                                className="field-input min-h-24"
                                value={speciesForm.notes}
                                onChange={(event) =>
                                  setSpeciesForm((current) => ({ ...current, notes: event.target.value }))
                                }
                              />
                            </Field>
                          </DataForm>
                        </CollapsiblePanel>

                        <CollapsiblePanel title={t.catalog.varietiesToolTitle} actionLabel={t.catalog.toolsOpen}>
                          <DataForm state={varietyState} onSubmit={submitVariety} submitLabel={t.catalog.saveVariety}>
                            <Field label={t.forms.species} name="speciesId" fieldErrors={varietyState.fieldErrors} optionalLabel={t.common.optional}>
                              <select
                                className="field-input"
                                value={varietyForm.speciesId}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, speciesId: event.target.value }))
                                }
                              >
                                <option value="">{t.common.selectSpecies}</option>
                                {(dashboard?.species ?? []).map((species) => (
                                  <option key={species.id} value={species.id}>
                                    {species.commonName}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label={t.forms.varietyName} name="name" fieldErrors={varietyState.fieldErrors} optionalLabel={t.common.optional}>
                              <input
                                className="field-input"
                                value={varietyForm.name}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, name: event.target.value }))
                                }
                              />
                            </Field>
                            <Field label={t.forms.tags} name="tags" fieldErrors={varietyState.fieldErrors} optional optionalLabel={t.common.optional}>
                              <input
                                className="field-input"
                                value={varietyForm.tags}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, tags: event.target.value }))
                                }
                                placeholder={t.forms.tagsPlaceholder}
                              />
                            </Field>
                            <Field label={t.forms.synonyms} name="synonyms" fieldErrors={varietyState.fieldErrors} optional optionalLabel={t.common.optional}>
                              <input
                                className="field-input"
                                value={varietyForm.synonyms}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, synonyms: event.target.value }))
                                }
                                placeholder={t.forms.synonymsPlaceholder}
                              />
                            </Field>
                            <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
                              <input
                                type="checkbox"
                                checked={varietyForm.heirloom}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, heirloom: event.target.checked }))
                                }
                              />
                              {t.catalog.heirloom}
                            </label>
                            <Field label={t.forms.description} name="description" fieldErrors={varietyState.fieldErrors} optional optionalLabel={t.common.optional}>
                              <textarea
                                className="field-input min-h-24"
                                value={varietyForm.description}
                                onChange={(event) =>
                                  setVarietyForm((current) => ({ ...current, description: event.target.value }))
                                }
                              />
                            </Field>
                          </DataForm>
                        </CollapsiblePanel>

                        <CollapsiblePanel title={t.catalog.batchesToolTitle} actionLabel={t.catalog.toolsOpen}>
                          <div className="grid gap-4">
                            <DataForm state={seedBatchState} onSubmit={submitSeedBatch} submitLabel={t.catalog.saveSeedBatch}>
                              <Field label={t.forms.variety} name="varietyId" fieldErrors={seedBatchState.fieldErrors} optionalLabel={t.common.optional}>
                                <select
                                  className="field-input"
                                  value={seedBatchForm.varietyId}
                                  onChange={(event) =>
                                    setSeedBatchForm((current) => ({ ...current, varietyId: event.target.value }))
                                  }
                                >
                                  <option value="">{t.common.selectVariety}</option>
                                  {(dashboard?.varieties ?? []).map((variety) => (
                                    <option key={variety.id} value={variety.id}>
                                      {variety.name}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Field label={t.forms.quantity} name="quantity" fieldErrors={seedBatchState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={seedBatchForm.quantity}
                                    onChange={(event) =>
                                      setSeedBatchForm((current) => ({ ...current, quantity: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.unit} name="unit" fieldErrors={seedBatchState.fieldErrors} optionalLabel={t.common.optional}>
                                  <select
                                    className="field-input"
                                    value={seedBatchForm.unit}
                                    onChange={(event) =>
                                      setSeedBatchForm((current) => ({
                                        ...current,
                                        unit: event.target.value as (typeof seedUnits)[number],
                                      }))
                                    }
                                  >
                                    {seedUnits.map((unit) => (
                                      <option key={unit} value={unit}>
                                        {labelSeedUnit(unit, t)}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                              </div>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Field label={t.forms.harvestYear} name="harvestYear" fieldErrors={seedBatchState.fieldErrors} optional optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min="1900"
                                    max="2100"
                                    value={seedBatchForm.harvestYear}
                                    onChange={(event) =>
                                      setSeedBatchForm((current) => ({ ...current, harvestYear: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.source} name="source" fieldErrors={seedBatchState.fieldErrors} optional optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    value={seedBatchForm.source}
                                    onChange={(event) =>
                                      setSeedBatchForm((current) => ({ ...current, source: event.target.value }))
                                    }
                                  />
                                </Field>
                              </div>
                              <Field label={t.forms.storageLocation} name="storageLocation" fieldErrors={seedBatchState.fieldErrors} optional optionalLabel={t.common.optional}>
                                <input
                                  className="field-input"
                                  value={seedBatchForm.storageLocation}
                                  onChange={(event) =>
                                    setSeedBatchForm((current) => ({
                                      ...current,
                                      storageLocation: event.target.value,
                                    }))
                                  }
                                />
                              </Field>
                            </DataForm>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <DataForm state={germinationState} onSubmit={submitGermination} submitLabel={t.catalog.logGermination}>
                                <Field label={t.forms.seedBatch} name="seedBatchId" fieldErrors={germinationState.fieldErrors} optionalLabel={t.common.optional}>
                                  <select
                                    className="field-input"
                                    value={germinationForm.seedBatchId}
                                    onChange={(event) =>
                                      setGerminationForm((current) => ({ ...current, seedBatchId: event.target.value }))
                                    }
                                  >
                                    <option value="">{t.common.selectBatch}</option>
                                    {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                                      <option key={seedBatch.id} value={seedBatch.id}>
                                        {(varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback)} · {seedBatch.quantity} {labelSeedUnit(seedBatch.unit, t).toLowerCase()}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label={t.forms.testDate} name="entryDate" fieldErrors={germinationState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="date"
                                    value={germinationForm.entryDate}
                                    onChange={(event) =>
                                      setGerminationForm((current) => ({ ...current, entryDate: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.sampleSize} name="sampleSize" fieldErrors={germinationState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    value={germinationForm.sampleSize}
                                    onChange={(event) =>
                                      setGerminationForm((current) => ({ ...current, sampleSize: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.germinatedCount} name="germinatedCount" fieldErrors={germinationState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    value={germinationForm.germinatedCount}
                                    onChange={(event) =>
                                      setGerminationForm((current) => ({ ...current, germinatedCount: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.resultNotes} name="details" fieldErrors={germinationState.fieldErrors} optional optionalLabel={t.common.optional}>
                                  <textarea
                                    className="field-input min-h-24"
                                    value={germinationForm.notes}
                                    onChange={(event) =>
                                      setGerminationForm((current) => ({ ...current, notes: event.target.value }))
                                    }
                                    placeholder={t.forms.resultNotesPlaceholder}
                                  />
                                </Field>
                              </DataForm>

                              <DataForm state={correctionState} onSubmit={submitCorrection} submitLabel={t.catalog.applyCorrection}>
                                <Field label={t.forms.seedBatch} name="seedBatchId" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <select
                                    className="field-input"
                                    value={correctionForm.seedBatchId}
                                    onChange={(event) =>
                                      setCorrectionForm((current) => ({ ...current, seedBatchId: event.target.value }))
                                    }
                                  >
                                    <option value="">{t.common.selectBatch}</option>
                                    {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                                      <option key={seedBatch.id} value={seedBatch.id}>
                                        {(varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback)} · {seedBatch.quantity} {labelSeedUnit(seedBatch.unit, t).toLowerCase()}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <Field label={t.forms.mode} name="mode" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                    <select
                                      className="field-input"
                                      value={correctionForm.mode}
                                      onChange={(event) =>
                                        setCorrectionForm((current) => ({
                                          ...current,
                                          mode: event.target.value as "SET_ABSOLUTE" | "ADJUST_DELTA",
                                        }))
                                      }
                                    >
                                      <option value="ADJUST_DELTA">{t.forms.adjustByDelta}</option>
                                      <option value="SET_ABSOLUTE">{t.forms.setAbsoluteQuantity}</option>
                                    </select>
                                  </Field>
                                  <Field label={t.forms.entryDate} name="entryDate" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                    <input
                                      className="field-input"
                                      type="date"
                                      value={correctionForm.entryDate}
                                      onChange={(event) =>
                                        setCorrectionForm((current) => ({ ...current, entryDate: event.target.value }))
                                      }
                                    />
                                  </Field>
                                </div>
                                <Field label={t.forms.quantityReferenced} name="quantity" fieldErrors={correctionState.fieldErrors} optional optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={correctionForm.quantity}
                                    onChange={(event) =>
                                      setCorrectionForm((current) => ({ ...current, quantity: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.reason} name="reason" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <textarea
                                    className="field-input min-h-24"
                                    value={correctionForm.reason}
                                    onChange={(event) =>
                                      setCorrectionForm((current) => ({ ...current, reason: event.target.value }))
                                    }
                                    placeholder={t.forms.reasonPlaceholder}
                                  />
                                </Field>
                              </DataForm>
                            </div>

                            <div className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
                              <h3 className="text-lg font-semibold">{t.catalog.reverseCorrectionTitle}</h3>
                              <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.68)]">
                                {t.catalog.reverseCorrectionCopy}
                              </p>
                              <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submitReversal}>
                                <Field label={t.forms.seedBatch} name="seedBatchId" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <select
                                    className="field-input"
                                    value={reversalForm.seedBatchId}
                                    onChange={(event) =>
                                      setReversalForm((current) => ({
                                        ...current,
                                        seedBatchId: event.target.value,
                                        transactionId: "",
                                      }))
                                    }
                                  >
                                    <option value="">{t.common.selectBatch}</option>
                                    {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                                      <option key={seedBatch.id} value={seedBatch.id}>
                                        {(varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback)} · {seedBatch.quantity} {labelSeedUnit(seedBatch.unit, t).toLowerCase()}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label={t.forms.correctionTransaction} name="transactionId" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <select
                                    className="field-input"
                                    value={reversalForm.transactionId}
                                    onChange={(event) =>
                                      setReversalForm((current) => ({ ...current, transactionId: event.target.value }))
                                    }
                                  >
                                    <option value="">{t.common.selectCorrection}</option>
                                    {((dashboard?.seedBatches ?? []).find((seedBatch) => seedBatch.id === reversalForm.seedBatchId)
                                      ?.stockTransactions ?? [])
                                      .filter(
                                        (transaction) =>
                                          transaction.type === "MANUAL_CORRECTION" && !transaction.reversalOfId,
                                      )
                                      .map((transaction) => (
                                        <option key={transaction.id} value={transaction.id}>
                                          {formatDate(transaction.effectiveDate, locale, t.common.notSet)} · {transaction.quantityDelta}
                                        </option>
                                      ))}
                                  </select>
                                </Field>
                                <Field label={t.forms.reversalDate} name="entryDate" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    type="date"
                                    value={reversalForm.entryDate}
                                    onChange={(event) =>
                                      setReversalForm((current) => ({ ...current, entryDate: event.target.value }))
                                    }
                                  />
                                </Field>
                                <Field label={t.forms.reason} name="reason" fieldErrors={correctionState.fieldErrors} optionalLabel={t.common.optional}>
                                  <input
                                    className="field-input"
                                    value={reversalForm.reason}
                                    onChange={(event) =>
                                      setReversalForm((current) => ({ ...current, reason: event.target.value }))
                                    }
                                  />
                                </Field>
                                <button className="w-fit rounded-lg bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white">
                                  {t.catalog.reverseCorrection}
                                </button>
                              </form>
                            </div>
                          </div>
                        </CollapsiblePanel>
                      </div>
                    </CollapsiblePanel>
                  </div>
                </Panel>
              ) : null}

              <Panel title={t.catalog.browseTitle} subtitle={t.catalog.browseSubtitle}>
                <div className="grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.7fr))]">
                    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                      <span>{t.catalog.searchLabel}</span>
                      <input
                        className="field-input"
                        value={catalogQuery}
                        onChange={(event) => setCatalogQuery(event.target.value)}
                        placeholder={t.catalog.searchPlaceholder}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                      <span>{t.catalog.categoryFilterLabel}</span>
                      <select
                        className="field-input"
                        value={catalogCategory}
                        onChange={(event) =>
                          setCatalogCategory(event.target.value as Species["category"] | "ALL")
                        }
                      >
                        <option value="ALL">{t.catalog.filterAll}</option>
                        {speciesCategories.map((category) => (
                          <option key={category} value={category}>
                            {labelSpeciesCategory(category, t)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                      <span>{t.catalog.stateFilterLabel}</span>
                      <select
                        className="field-input"
                        value={catalogView}
                        onChange={(event) =>
                          setCatalogView(event.target.value as "ALL" | "ON_HAND" | "ATTENTION")
                        }
                      >
                        <option value="ALL">{t.catalog.filterAll}</option>
                        <option value="ON_HAND">{t.catalog.filterOnHand}</option>
                        <option value="ATTENTION">{t.catalog.filterAttention}</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <CatalogSummaryCard
                      label={t.stats.varieties}
                      value={catalogEntries.length}
                    />
                    <CatalogSummaryCard
                      label={t.stats.seedBatches}
                      value={catalogEntries.reduce((sum, entry) => sum + entry.seedBatches.length, 0)}
                    />
                    <CatalogSummaryCard
                      label={t.catalog.needsAttention}
                      value={catalogEntries.filter((entry) => entry.warnings.length > 0).length}
                    />
                  </div>
                </div>
              </Panel>

              <Panel title={t.catalog.inventoryTitle} subtitle={t.catalog.inventorySubtitle}>
                <p className="mb-4 max-w-[42ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                  {t.catalog.listHint}
                </p>
                {catalogEntries.length ? (
                  <div className="grid gap-3">
                    {catalogEntries.map((entry) => (
                      <CatalogVarietyCard
                        key={entry.variety.id}
                        variety={entry.variety}
                        species={entry.species}
                        seedBatches={entry.seedBatches}
                        warningsByBatch={storageWarningsByBatch}
                        latestTest={entry.latestTest}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState title={t.catalog.noResultsTitle} copy={t.catalog.noResultsCopy} />
                )}
              </Panel>
            </div>
          ) : null}

          {view === "sheets" ? (
            <div className="space-y-4">
              <section className="print-hide rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
                <ScreenHeader
                  eyebrow={t.sheets.eyebrow}
                  title={t.sheets.heroTitle}
                  subtitle={t.sheets.heroSubtitle}
                  titleClassName="max-w-[23ch]"
                />
              </section>

              <div className="print-hide grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Panel title={t.sheets.controlsTitle} subtitle={t.sheets.controlsSubtitle}>
                  <div className="grid gap-4">
                    <Field
                      label={t.sheets.contentLabel}
                      name="print-scope"
                      fieldErrors={{}}
                      optionalLabel={t.common.optional}
                    >
                      <select
                        className="field-input"
                        value={printScope}
                        onChange={(event) =>
                          setPrintScope(event.target.value as "ALL" | "DIGEST" | "VARIETIES" | "BATCHES")
                        }
                      >
                        <option value="ALL">{t.sheets.allSheets}</option>
                        <option value="DIGEST">{t.sheets.digestOnly}</option>
                        <option value="VARIETIES">{t.sheets.varietySheetsOnly}</option>
                        <option value="BATCHES">{t.sheets.batchSheetsOnly}</option>
                      </select>
                    </Field>

                    <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={printOnlyStocked}
                        onChange={(event) => setPrintOnlyStocked(event.target.checked)}
                      />
                      {t.sheets.stockedOnly}
                    </label>

                    <label className="flex items-center gap-3 text-sm font-medium text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={printIncludeNotes}
                        onChange={(event) => setPrintIncludeNotes(event.target.checked)}
                      />
                      {t.sheets.includeNotes}
                    </label>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="w-full rounded-lg bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white sm:w-fit"
                    >
                      {t.sheets.openPrintDialog}
                    </button>

                    <p className="max-w-[42ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                      {t.sheets.exportHint}
                    </p>
                  </div>
                </Panel>

                <Panel title={t.sheets.previewTitle} subtitle={t.sheets.previewSubtitle}>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <CatalogSummaryCard label={t.sheets.varietiesStat} value={printableCatalogEntries.length} />
                    <CatalogSummaryCard label={t.sheets.batchesStat} value={printableBatchCards.length} />
                    <CatalogSummaryCard
                      label={t.sheets.warningsStat}
                      value={printableBatchCards.reduce(
                        (sum, entry) => sum + entry.warnings.filter((warning) => warning.level !== "info").length,
                        0,
                      )}
                    />
                    <CatalogSummaryCard label={t.sheets.calendarStat} value={dashboard?.calendar.length ?? 0} />
                  </div>
                </Panel>
              </div>

              <div className="print-root mx-auto w-full max-w-[210mm] space-y-6 overflow-x-clip print:max-w-none print:space-y-0 print:overflow-visible">
                {printScope === "ALL" || printScope === "DIGEST" ? (
                  <PrintPage>
                    <DigestSheet
                      workspaceName={session.membership.workspace.name}
                      generatedAt={new Date().toISOString()}
                      locale={locale}
                      t={t}
                      activeProfile={activeProfile}
                      calendarItems={dashboard?.calendar ?? []}
                      entries={printableCatalogEntries}
                    />
                  </PrintPage>
                ) : null}

                {printScope === "ALL" || printScope === "VARIETIES"
                  ? printableVarietyPages.map((entries, index) => (
                      <PrintPage key={`variety-page-${index}`}>
                        <div className="grid h-full gap-4">
                          {entries.map((entry) => (
                            <VarietySheetCard
                              key={entry.variety.id}
                              entry={entry}
                              locale={locale}
                              t={t}
                              includeNotes={printIncludeNotes}
                            />
                          ))}
                        </div>
                      </PrintPage>
                    ))
                  : null}

                {printScope === "ALL" || printScope === "BATCHES"
                  ? printableBatchPages.map((entries, index) => (
                      <PrintPage key={`batch-page-${index}`}>
                        <div className="grid h-full gap-4 md:grid-cols-2">
                          {entries.map((entry) => (
                            <BatchSheetCard
                              key={entry.seedBatch.id}
                              entry={entry}
                              locale={locale}
                              t={t}
                              includeNotes={printIncludeNotes}
                            />
                          ))}
                        </div>
                      </PrintPage>
                    ))
                  : null}
              </div>
            </div>
          ) : null}

          {view === "profiles" ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
                <ScreenHeader
                  eyebrow={t.profiles.eyebrow}
                  title={t.profiles.heroTitle}
                  subtitle={t.profiles.heroSubtitle}
                  titleClassName="max-w-[26ch]"
                />
              </section>
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title={t.profiles.title} subtitle={t.profiles.subtitle}>
                <DataForm state={profileState} onSubmit={submitProfile} submitLabel={t.profiles.saveProfile}>
                  <Field label={t.forms.profileName} name="name" fieldErrors={profileState.fieldErrors} optionalLabel={t.common.optional}>
                    <input
                      className="field-input"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t.forms.lastFrostDate} name="lastFrostDate" fieldErrors={profileState.fieldErrors} optionalLabel={t.common.optional}>
                      <input
                        className="field-input"
                        type="date"
                        value={profileForm.lastFrostDate}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, lastFrostDate: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label={t.forms.firstFrostDate} name="firstFrostDate" fieldErrors={profileState.fieldErrors} optionalLabel={t.common.optional}>
                      <input
                        className="field-input"
                        type="date"
                        value={profileForm.firstFrostDate}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, firstFrostDate: event.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={profileForm.isActive}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, isActive: event.target.checked }))
                      }
                    />
                    {t.profiles.markActive}
                  </label>
                  <Field label={t.forms.notes} name="notes" fieldErrors={profileState.fieldErrors} optional optionalLabel={t.common.optional}>
                    <textarea
                      className="field-input min-h-24"
                      value={profileForm.notes}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </Field>
                </DataForm>
              </Panel>

              <div className="space-y-4">
                <Panel title={t.profiles.helperTitle} subtitle={t.profiles.helperSubtitle}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {phenologyStageIds.map((stageId) => (
                      <article
                        key={stageId}
                        className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <h3 className="text-base font-semibold">{t.phenologyStages[stageId].label}</h3>
                        <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{t.phenologyStages[stageId].hint}</p>
                      </article>
                    ))}
                  </div>
                </Panel>

                <Panel title={t.profiles.summaryTitle} subtitle={t.profiles.summarySubtitle}>
                  {dashboard?.profiles.length ? (
                    <div className="grid gap-3">
                      {dashboard.profiles.map((profile) => (
                        <article
                          key={profile.id}
                          className={classNames(
                            "rounded-lg border px-4 py-4",
                            profile.isActive
                              ? "border-[var(--accent)] bg-[color:rgba(127,155,71,0.12)]"
                              : "border-[var(--border)] bg-[var(--muted)]",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold">{profile.name}</h3>
                            {profile.isActive ? (
                              <span className="rounded-md bg-[var(--foreground)] px-3 py-1 text-xs font-semibold text-white">
                                {t.common.active}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">
                            {t.profiles.lastFrost} {formatDate(profile.lastFrostDate, locale, t.common.notSet)} · {t.profiles.firstFrost} {formatDate(profile.firstFrostDate, locale, t.common.notSet)}
                          </p>
                          <div className="mt-4 grid gap-2">
                            <label className="grid gap-2 text-sm font-medium">
                              <span>{t.profiles.observedStage}</span>
                              <select
                                className="field-input"
                                value={profile.phenologyStage ?? ""}
                                onChange={(event) => {
                                  void updateProfilePhenology(profile.id, {
                                    phenologyStage: event.target.value || null,
                                    phenologyObservedAt: new Date().toISOString(),
                                    phenologyNotes: profile.phenologyNotes ?? null,
                                  }).then(loadDashboard).catch((error) => setProfileState(toFormState(error, t)));
                                }}
                              >
                                <option value="">{t.profiles.none}</option>
                                {phenologyStageIds.map((stageId) => (
                                  <option key={stageId} value={stageId}>
                                    {t.phenologyStages[stageId].label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                              {(profile.phenologyStage
                                ? t.phenologyStages[profile.phenologyStage as keyof typeof t.phenologyStages]?.hint
                                : undefined) || t.profiles.phenologyFallback}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <label className="grid gap-2 text-sm font-medium">
                              <span>{t.profiles.phenologyNotes}</span>
                              <textarea
                                className="field-input min-h-20"
                                value={profile.phenologyNotes ?? ""}
                                onChange={(event) => {
                                  void updateProfilePhenology(profile.id, {
                                    phenologyStage: profile.phenologyStage ?? null,
                                    phenologyObservedAt: profile.phenologyObservedAt ?? new Date().toISOString(),
                                    phenologyNotes: event.target.value || null,
                                  }).then(loadDashboard).catch((error) => setProfileState(toFormState(error, t)));
                                }}
                              />
                            </label>
                          </div>
                        {profile.notes ? (
                            <p className="mt-3 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
                              {profile.notes}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={t.profiles.noProfilesTitle}
                      copy={t.profiles.noProfilesCopy}
                    />
                  )}
                </Panel>
              </div>
              </div>
            </div>
          ) : null}

          {view === "rules" ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
                <ScreenHeader
                  eyebrow={t.rules.eyebrow}
                  title={t.rules.heroTitle}
                  subtitle={t.rules.heroSubtitle}
                  titleClassName="max-w-[22ch]"
                />
              </section>
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title={t.rules.title} subtitle={t.rules.subtitle}>
                <DataForm state={ruleState} onSubmit={submitRule} submitLabel={t.rules.saveRule}>
                  <Field label={t.forms.variety} name="varietyId" fieldErrors={ruleState.fieldErrors} optionalLabel={t.common.optional}>
                    <select
                      className="field-input"
                      value={ruleForm.varietyId}
                      onChange={(event) =>
                        setRuleForm((current) => ({ ...current, varietyId: event.target.value }))
                      }
                    >
                      <option value="">{t.common.selectVariety}</option>
                      {(dashboard?.varieties ?? []).map((variety) => (
                        <option key={variety.id} value={variety.id}>
                          {variety.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <RuleGrid form={ruleForm} setForm={setRuleForm} t={t} />
                </DataForm>
              </Panel>

              <Panel title={t.rules.currentTitle} subtitle={t.rules.currentSubtitle}>
                {dashboard?.rules.length ? (
                  <div className="grid gap-3">
                    {dashboard.rules.map((rule) => (
                      <article
                        key={rule.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <h3 className="text-lg font-semibold">{rule.variety.name}</h3>
                        <div className="mt-3 grid gap-2 text-sm text-[color:rgba(24,49,40,0.72)] md:grid-cols-2">
                          <p>{t.rules.indoorSowing}: {nullableRange(rule.sowIndoorsStartWeeks, rule.sowIndoorsEndWeeks, t.rules.weeksBefore, t.common.notDefined)}</p>
                          <p>{t.rules.outdoorSowing}: {nullableRange(rule.sowOutdoorsStartWeeks, rule.sowOutdoorsEndWeeks, t.rules.weeksBefore, t.common.notDefined)}</p>
                          <p>{t.rules.transplant}: {nullableRange(rule.transplantStartWeeks, rule.transplantEndWeeks, t.rules.weeksAfter, t.common.notDefined)}</p>
                          <p>{t.rules.harvest}: {nullableRange(rule.harvestStartDays, rule.harvestEndDays, t.rules.daysAfter, t.common.notDefined)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t.rules.noRulesTitle}
                    copy={t.rules.noRulesCopy}
                  />
                )}
              </Panel>
              </div>
            </div>
          ) : null}

          {view === "plantings" ? (
            <div className="space-y-4">
              <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
                <ScreenHeader
                  eyebrow={t.plantings.eyebrow}
                  title={t.plantings.heroTitle}
                  subtitle={t.plantings.heroSubtitle}
                  titleClassName="max-w-[22ch]"
                />
              </section>
              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title={t.plantings.title} subtitle={t.plantings.subtitle}>
                <DataForm state={plantingState} onSubmit={submitPlanting} submitLabel={t.plantings.savePlanting}>
                  <Field label={t.forms.variety} name="varietyId" fieldErrors={plantingState.fieldErrors} optionalLabel={t.common.optional}>
                    <select
                      className="field-input"
                      value={plantingForm.varietyId}
                      onChange={(event) =>
                        setPlantingForm((current) => ({
                          ...current,
                          varietyId: event.target.value,
                          seedBatchId: "",
                        }))
                      }
                    >
                      <option value="">{t.common.selectVariety}</option>
                      {(dashboard?.varieties ?? []).map((variety) => (
                        <option key={variety.id} value={variety.id}>
                          {variety.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t.forms.type} name="type" fieldErrors={plantingState.fieldErrors} optionalLabel={t.common.optional}>
                      <select
                        className="field-input"
                        value={plantingForm.type}
                        onChange={(event) =>
                          setPlantingForm((current) => ({
                            ...current,
                            type: event.target.value as (typeof plantingTypes)[number],
                          }))
                        }
                        >
                          {plantingTypes.map((type) => (
                            <option key={type} value={type}>
                              {labelPlantingType(type, t)}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label={t.forms.growingProfile} name="growingProfileId" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                      <select
                        className="field-input"
                        value={plantingForm.growingProfileId}
                        onChange={(event) =>
                          setPlantingForm((current) => ({
                            ...current,
                            growingProfileId: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t.common.none}</option>
                        {(dashboard?.profiles ?? []).map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t.forms.seedBatch} name="seedBatchId" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                      <select
                        className="field-input"
                        value={plantingForm.seedBatchId}
                        onChange={(event) =>
                          setPlantingForm((current) => ({ ...current, seedBatchId: event.target.value }))
                        }
                      >
                        <option value="">{t.common.none}</option>
                        {seedBatchesForSelectedVariety.map((seedBatch) => (
                          <option key={seedBatch.id} value={seedBatch.id}>
                            {(varietiesById.get(seedBatch.varietyId)?.name ?? t.common.batchFallback)} · {seedBatch.quantity} {labelSeedUnit(seedBatch.unit, t).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t.forms.quantityUsed} name="quantityUsed" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                      <input
                        className="field-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={plantingForm.quantityUsed}
                        onChange={(event) =>
                          setPlantingForm((current) => ({
                            ...current,
                            quantityUsed: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t.forms.plannedDate} name="plannedDate" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                      <input
                        className="field-input"
                        type="date"
                        value={plantingForm.plannedDate}
                        onChange={(event) =>
                          setPlantingForm((current) => ({
                            ...current,
                            plannedDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label={t.forms.actualDate} name="actualDate" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                      <input
                        className="field-input"
                        type="date"
                        value={plantingForm.actualDate}
                        onChange={(event) =>
                          setPlantingForm((current) => ({
                            ...current,
                            actualDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label={t.forms.locationNote} name="locationNote" fieldErrors={plantingState.fieldErrors} optional optionalLabel={t.common.optional}>
                    <input
                      className="field-input"
                      value={plantingForm.locationNote}
                      onChange={(event) =>
                        setPlantingForm((current) => ({ ...current, locationNote: event.target.value }))
                      }
                    />
                  </Field>
                </DataForm>
              </Panel>

              <Panel title={t.plantings.ledgerTitle} subtitle={t.plantings.ledgerSubtitle}>
                {dashboard?.plantings.length ? (
                  <div className="grid gap-3">
                    {dashboard.plantings.map((event) => (
                      <article
                        key={event.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            {varietiesById.get(event.varietyId)?.name ?? t.common.unknownVariety}
                          </h3>
                          <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold">
                            {labelPlantingType(event.type, t)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">
                          {event.actualDate ? `${t.plantings.actual} ${formatDate(event.actualDate, locale, t.common.notSet)}` : `${t.plantings.planned} ${formatDate(event.plannedDate, locale, t.common.notSet)}`}
                          {event.quantityUsed ? ` · ${t.plantings.used} ${event.quantityUsed}` : ""}
                        </p>
                        {event.locationNote ? (
                          <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">{event.locationNote}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t.plantings.noLedgerTitle}
                    copy={t.plantings.noLedgerCopy}
                  />
                )}
              </Panel>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  supportingCopy,
  titleClassName,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  supportingCopy?: string;
  titleClassName?: string;
  compact?: boolean;
}) {
  return (
    <div>
      {eyebrow ? (
        <p
          className={classNames(
            "font-semibold uppercase tracking-[0.25em] text-[var(--accent-strong)]",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={classNames(
          compact
            ? classNames(eyebrow ? "mt-1.5" : "mt-0", "max-w-[24ch] text-[1.75rem] font-semibold tracking-tight text-balance leading-tight md:text-[2rem]")
            : classNames(eyebrow ? "mt-2" : "mt-0", "max-w-[18ch] text-[2.2rem] font-semibold tracking-tight text-balance leading-[1.05] md:text-[2.85rem]"),
          titleClassName,
        )}
      >
        {title}
      </h2>
      <p
        className={classNames(
          "max-w-[34rem] text-[color:rgba(24,49,40,0.82)]",
          compact ? "mt-1.5 text-sm leading-6 md:text-base" : "mt-2 text-base leading-7 md:text-lg",
        )}
      >
        {subtitle}
      </p>
      {supportingCopy ? (
        <p
          className={classNames(
            "max-w-[38rem] text-[color:rgba(24,49,40,0.68)]",
            compact ? "mt-2 text-sm leading-6" : "mt-3 text-sm leading-6 md:text-base",
          )}
        >
          {supportingCopy}
        </p>
      ) : null}
    </div>
  );
}

function BrandLockup({
  className,
  priority = false,
  variant = "transparent",
}: {
  className?: string;
  priority?: boolean;
  variant?: "transparent" | "inverted";
}) {
  const asset =
    variant === "inverted"
      ? {
          src: "/brand/logo-inverted.png",
          width: 688,
          height: 320,
        }
      : {
          src: "/brand/logo-transparent.png",
          width: 850,
          height: 242,
        };

  return (
    <Image
      src={asset.src}
      alt="Saatgut"
      width={asset.width}
      height={asset.height}
      priority={priority}
      className={className}
    />
  );
}

function BrandIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-icon.png"
      alt="Saatgut Icon"
      width={229}
      height={242}
      className={className}
    />
  );
}

type PrintableCatalogEntry = {
  variety: Variety;
  species: Variety["species"] | Species | null;
  seedBatches: SeedBatch[];
  warnings: SeedBatchWarning[];
  latestTest: NonNullable<SeedBatch["germinationTests"]>[number] | null;
};

function PrintPage({ children }: { children: React.ReactNode }) {
  return (
    <section className="print-page mx-auto w-full max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <div className="print-page-inner min-h-[297mm] p-6 md:p-8 print:min-h-0 print:p-[12mm]">{children}</div>
    </section>
  );
}

function DigestSheet({
  workspaceName,
  generatedAt,
  locale,
  t,
  activeProfile,
  calendarItems,
  entries,
}: {
  workspaceName: string;
  generatedAt: string;
  locale: Locale;
  t: AppMessages;
  activeProfile: GrowingProfile | null;
  calendarItems: CalendarItem[];
  entries: PrintableCatalogEntry[];
}) {
  const warningCount = entries.reduce(
    (sum, entry) => sum + entry.warnings.filter((warning) => warning.level !== "info").length,
    0,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="max-w-[34rem]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            {t.sheets.digestTitle}
          </p>
          <h2 className="mt-2 max-w-[18ch] text-[2rem] font-semibold tracking-tight leading-tight">
            {workspaceName}
          </h2>
          <p className="mt-2 max-w-[44rem] text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
            {t.sheets.digestSubtitle}
          </p>
          <p className="mt-2 max-w-[44rem] text-sm leading-6 text-[color:rgba(24,49,40,0.62)]">
            {t.sheets.digestIntro}
          </p>
        </div>
        <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm sm:w-auto sm:min-w-[11rem]">
          <p className="font-semibold text-[var(--foreground)]">{t.sheets.generatedOn}</p>
          <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
            {formatDate(generatedAt, locale, t.common.notSet)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DigestStatCard label={t.sheets.varietiesStat} value={entries.length} />
        <DigestStatCard label={t.sheets.batchesStat} value={entries.reduce((sum, entry) => sum + entry.seedBatches.length, 0)} />
        <DigestStatCard label={t.sheets.warningsStat} value={warningCount} />
        <DigestStatCard label={t.sheets.calendarStat} value={calendarItems.length} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {t.sheets.activeProfileLabel}
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            {activeProfile ? activeProfile.name : t.sheets.noActiveProfile}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
            {activeProfile
              ? `${t.sheets.frostWindow}: ${formatDate(activeProfile.lastFrostDate, locale, t.common.notSet)} ${t.calendar.rangeSeparator} ${formatDate(activeProfile.firstFrostDate, locale, t.common.notSet)}`
              : t.dashboard.createActiveProfile}
          </p>
          {activeProfile?.phenologyStage ? (
            <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
              {t.profiles.observedStage}: {t.phenologyStages[activeProfile.phenologyStage as keyof typeof t.phenologyStages]?.label ?? activeProfile.phenologyStage}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {t.sheets.nextDates}
          </p>
          {calendarItems.length ? (
            <div className="mt-3 grid gap-2">
              {calendarItems.slice(0, 5).map((item, index) => (
                <div
                  key={`${item.kind}-${index}`}
                  className="flex items-center justify-between gap-3 border-b border-[color:rgba(24,49,40,0.08)] pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {item.kind === "window"
                        ? `${t.calendar.windowLabel[item.type]} · ${item.varietyName}`
                        : item.kind === "recorded"
                          ? `${labelPlantingType(item.event.type, t)} · ${item.varietyName}`
                          : `${t.calendar.windowLabel[item.type]} · ${item.varietyName}`}
                    </p>
                    <p className="text-sm text-[color:rgba(24,49,40,0.68)]">
                      {summarizeCalendarItem(item, locale, t)}
                    </p>
                  </div>
                  <p className="text-right text-sm font-medium sm:whitespace-nowrap">
                    {formatCalendarDate(item, locale, t.common.notSet)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">{t.sheets.noCalendar}</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex-1 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
          {t.sheets.focusVarieties}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {entries.slice(0, 8).map((entry) => (
            <div key={entry.variety.id} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold">{entry.variety.name}</h3>
                  <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.68)]">
                    {entry.species?.commonName ?? t.common.notSet}
                  </p>
                </div>
                <p className="text-right text-sm font-medium sm:whitespace-nowrap">
                  {entry.seedBatches.length} {t.stats.seedBatches.toLowerCase()}
                </p>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-[color:rgba(24,49,40,0.72)]">
                <p>
                  {t.sheets.stockLabel}:{" "}
                  {entry.seedBatches.length
                    ? entry.seedBatches
                        .map((seedBatch) =>
                          formatSeedQuantity(seedBatch.quantity, seedBatch.unit, locale, t, t.common.notSet),
                        )
                        .join(" · ")
                    : t.sheets.noBatches}
                </p>
                <p>
                  {t.sheets.latestTestLabel}:{" "}
                  {entry.latestTest
                    ? `${formatDate(entry.latestTest.testedAt, locale, t.common.notSet)} · ${entry.latestTest.germinationRate ?? "?"}%`
                    : t.sheets.noTest}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VarietySheetCard({
  entry,
  locale,
  t,
  includeNotes,
}: {
  entry: PrintableCatalogEntry;
  locale: Locale;
  t: AppMessages;
  includeNotes: boolean;
}) {
  const rule = entry.variety.cultivationRule;

  return (
    <article className="sheet-card flex flex-col rounded-lg border border-[var(--border)] bg-[var(--muted)] p-5">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {t.sheets.varietySheetLabel}
          </p>
          <h3 className="mt-2 break-words text-[1.75rem] font-semibold tracking-tight leading-tight">
            {entry.variety.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
            {t.sheets.speciesLabel}: {entry.species?.commonName ?? t.common.notSet}
            {entry.species?.latinName ? ` · ${entry.species.latinName}` : ""}
            {entry.species?.category ? ` · ${labelSpeciesCategory(entry.species.category, t)}` : ""}
          </p>
        </div>
        <div className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm sm:w-auto sm:min-w-[10rem]">
          <p className="font-semibold">{t.sheets.stockLabel}</p>
          <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
            {entry.seedBatches.length
              ? entry.seedBatches
                  .map((seedBatch) =>
                    formatSeedQuantity(seedBatch.quantity, seedBatch.unit, locale, t, t.common.notSet),
                  )
                  .join(" · ")
              : t.sheets.noBatches}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          {entry.variety.description ? (
            <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.74)]">{entry.variety.description}</p>
          ) : null}

          {(entry.variety.tags.length > 0 || (entry.variety.synonyms?.length ?? 0) > 0) ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <SheetTagList
                title={t.sheets.tagsLabel}
                items={entry.variety.tags}
              />
              <SheetTagList
                title={t.sheets.synonymsLabel}
                items={(entry.variety.synonyms ?? []).map((synonym) => synonym.name)}
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
              {t.sheets.rulesLabel}
            </p>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
              <p>{t.rules.indoorSowing}: {rule ? nullableRange(rule.sowIndoorsStartWeeks, rule.sowIndoorsEndWeeks, t.rules.weeksBefore, t.common.notDefined) : t.common.notDefined}</p>
              <p>{t.rules.outdoorSowing}: {rule ? nullableRange(rule.sowOutdoorsStartWeeks, rule.sowOutdoorsEndWeeks, t.rules.weeksBefore, t.common.notDefined) : t.common.notDefined}</p>
              <p>{t.rules.transplant}: {rule ? nullableRange(rule.transplantStartWeeks, rule.transplantEndWeeks, t.rules.weeksAfter, t.common.notDefined) : t.common.notDefined}</p>
              <p>{t.rules.harvest}: {rule ? nullableRange(rule.harvestStartDays, rule.harvestEndDays, t.rules.daysAfter, t.common.notDefined) : t.common.notDefined}</p>
            </div>
          </div>

          {includeNotes && entry.variety.notes ? (
            <SheetSection title={t.sheets.notesLabel}>
              <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{entry.variety.notes}</p>
            </SheetSection>
          ) : null}
        </div>

        <SheetSection title={t.catalog.batchListTitle}>
          {entry.seedBatches.length ? (
            <div className="grid gap-3">
              {entry.seedBatches.map((seedBatch) => {
                const latestTest =
                  [...(seedBatch.germinationTests ?? [])].sort(
                    (left, right) => new Date(right.testedAt).getTime() - new Date(left.testedAt).getTime(),
                  )[0] ?? null;
                const warnings = (seedBatch.storageWarnings ?? []).filter((warning) => warning.level !== "info");

                return (
                  <div key={seedBatch.id} className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {seedBatch.source ?? t.common.batchFallback}
                          {seedBatch.harvestYear ? ` · ${t.seedBatch.harvestPrefix} ${seedBatch.harvestYear}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.68)]">
                          {t.sheets.quantityLabel}:{" "}
                          {formatSeedQuantity(seedBatch.quantity, seedBatch.unit, locale, t, t.common.notSet)}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {latestTest
                          ? `${latestTest.germinationRate ?? "?"}%`
                          : t.sheets.noTest}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.68)]">
                      {t.sheets.storageLabel}: {seedBatch.storageLocation || t.sheets.storageFallback}
                    </p>
                    {warnings.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {warnings.slice(0, 3).map((warning) => (
                          <span key={`${seedBatch.id}-${warning.code}`} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
                            {getWarningTitle(warning.code, warning.title, t)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">{t.sheets.noBatches}</p>
          )}
        </SheetSection>
      </div>
    </article>
  );
}

function BatchSheetCard({
  entry,
  locale,
  t,
  includeNotes,
}: {
  entry: {
    seedBatch: SeedBatch;
    variety: Variety;
    species: Variety["species"] | Species | null;
    warnings: SeedBatchWarning[];
    latestTest: NonNullable<SeedBatch["germinationTests"]>[number] | null;
    latestAdjustment: SeedBatchTransaction | null;
  };
  locale: Locale;
  t: AppMessages;
  includeNotes: boolean;
}) {
  const visibleWarnings = entry.warnings.filter((warning) => warning.level !== "info");

  return (
    <article className="sheet-card flex min-h-[10.8rem] flex-col rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
            {t.sheets.batchSheetLabel}
          </p>
          <h3 className="mt-1 break-words text-xl font-semibold leading-tight">{entry.variety.name}</h3>
          <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.68)]">
            {entry.species?.commonName ?? t.common.notSet}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-right text-sm">
          <p className="font-semibold">{t.sheets.stockLabel}</p>
          <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
            {formatSeedQuantity(entry.seedBatch.quantity, entry.seedBatch.unit, locale, t, t.common.notSet)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid flex-1 gap-3">
        <div className="grid gap-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
          <p>{t.sheets.sourceLabel}: {entry.seedBatch.source ?? t.common.notSet}</p>
          <p>{t.sheets.harvestYearLabel}: {entry.seedBatch.harvestYear ?? t.seedBatch.yearUnknown}</p>
          <p>{t.sheets.storageLabel}: {entry.seedBatch.storageLocation || t.sheets.storageFallback}</p>
          <p>
            {t.sheets.latestTestLabel}:{" "}
            {entry.latestTest
              ? `${formatDate(entry.latestTest.testedAt, locale, t.common.notSet)} · ${entry.latestTest.germinationRate ?? "?"}%`
              : t.sheets.noTest}
          </p>
          {entry.latestAdjustment ? (
            <p>
              {t.seedBatch.correctionHistoryTitle}: {formatDate(entry.latestAdjustment.effectiveDate, locale, t.common.notSet)}
            </p>
          ) : null}
        </div>

        {visibleWarnings.length ? (
          <SheetSection title={t.sheets.warningsLabel}>
            <div className="flex flex-wrap gap-2">
              {visibleWarnings.slice(0, 4).map((warning) => (
                <span key={`${entry.seedBatch.id}-${warning.code}`} className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-semibold">
                  {getWarningTitle(warning.code, warning.title, t)}
                </span>
              ))}
            </div>
          </SheetSection>
        ) : null}

        {includeNotes && entry.seedBatch.notes ? (
          <SheetSection title={t.sheets.notesLabel}>
            <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{entry.seedBatch.notes}</p>
          </SheetSection>
        ) : null}
      </div>
    </article>
  );
}

function DigestStatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:rgba(24,49,40,0.58)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SheetTagList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;

  return (
    <SheetSection title={title}>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${title}-${item}`} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold">
            {item}
          </span>
        ))}
      </div>
    </SheetSection>
  );
}

function CatalogSummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-white/70 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:rgba(24,49,40,0.58)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function CollapsiblePanel({
  title,
  actionLabel,
  children,
}: {
  title: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-[var(--border)] bg-white/70 p-4 open:bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
        <span className="min-w-0 text-balance">{title}</span>
        <span className="text-xs uppercase tracking-[0.18em] text-[color:rgba(24,49,40,0.46)]">
          {actionLabel}
        </span>
      </summary>
      <div className="mt-4 border-t border-[var(--border)] pt-4">{children}</div>
    </details>
  );
}

function CatalogVarietyCard({
  variety,
  species,
  seedBatches,
  warningsByBatch,
  latestTest,
  locale,
  t,
}: {
  variety: Variety;
  species: Variety["species"] | Species | null;
  seedBatches: SeedBatch[];
  warningsByBatch: Map<string, NonNullable<SeedBatch["storageWarnings"]>>;
  latestTest: NonNullable<SeedBatch["germinationTests"]>[number] | null;
  locale: Locale;
  t: AppMessages;
}) {
  const warningCount = seedBatches.reduce(
    (sum, seedBatch) => sum + (warningsByBatch.get(seedBatch.id) ?? []).filter((warning) => warning.level !== "info").length,
    0,
  );

  return (
    <details className="group rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4 open:bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold break-words">{variety.name}</h3>
            {variety.heirloom ? (
              <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-strong)] group-open:bg-[var(--muted)]">
                {t.catalog.heirloom}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
            {species?.commonName ?? t.common.notSet}
            {species?.latinName ? ` · ${species.latinName}` : ""}
            {species?.category ? ` · ${labelSpeciesCategory(species.category, t)}` : ""}
          </p>
          <p className="mt-3 max-w-[44rem] text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
            {seedBatches.length} {t.catalog.batchesOnHand} · {warningCount} {t.catalog.needsAttention} · {t.catalog.latestCheck}{" "}
            {latestTest ? formatDate(latestTest.testedAt, locale, t.common.notSet) : t.common.notSet}
          </p>
        </div>
        <span className="rounded-md border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:rgba(24,49,40,0.58)] group-open:hidden">
          {t.catalog.expandItem}
        </span>
        <span className="hidden rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:rgba(24,49,40,0.58)] group-open:inline-flex">
          {t.catalog.collapseItem}
        </span>
      </summary>

      <div className="mt-5 border-t border-[var(--border)] pt-5">
        {variety.description ? (
          <p className="max-w-[42rem] text-sm leading-6 text-[color:rgba(24,49,40,0.74)]">
            {variety.description}
          </p>
        ) : null}

        {variety.tags.length || variety.synonyms?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {variety.tags.map((tag) => (
              <span key={`${variety.id}-${tag}`} className="max-w-full rounded-md bg-[var(--muted)] px-3 py-1 text-xs font-semibold break-words">
                {tag}
              </span>
            ))}
            {(variety.synonyms ?? []).map((synonym) => (
              <span
                key={synonym.id}
                className="max-w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-1 text-xs font-semibold break-words"
              >
                {synonym.name}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            {t.catalog.batchListTitle}
          </p>
          {seedBatches.length ? (
            <div className="mt-3 grid gap-3">
              {seedBatches.map((seedBatch) => (
                <SeedBatchCard
                  key={seedBatch.id}
                  seedBatch={seedBatch}
                  varietyName={variety.name}
                  warnings={warningsByBatch.get(seedBatch.id) ?? []}
                  germinationTests={seedBatch.germinationTests ?? []}
                  adjustments={seedBatch.stockTransactions?.filter((transaction) => transaction.type !== "INITIAL_STOCK") ?? []}
                  locale={locale}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md bg-[var(--muted)] px-3 py-3 text-sm text-[color:rgba(24,49,40,0.68)]">
              {t.catalog.noBatches}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
      <div className="mb-5">
        <h2 className="max-w-[20ch] text-xl font-semibold tracking-tight text-balance md:text-2xl">{title}</h2>
        <p className="mt-2 max-w-[40rem] text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  fieldErrors,
  optional = false,
  optionalLabel,
  tone = "default",
  children,
}: {
  label: string;
  name: string;
  fieldErrors: Record<string, string[] | undefined>;
  optional?: boolean;
  optionalLabel: string;
  tone?: "default" | "inverse";
  children: React.ReactNode;
}) {
  return (
    <label
      className={classNames(
        "grid gap-2 text-sm font-medium",
        tone === "inverse" ? "text-white" : "text-[var(--foreground)]",
      )}
    >
      <span className="flex items-center gap-2">
        {label}
        {optional ? (
          <span
            className={classNames(
              "text-xs font-normal",
              tone === "inverse" ? "text-white/72" : "text-[color:rgba(24,49,40,0.56)]",
            )}
          >
            {optionalLabel}
          </span>
        ) : null}
      </span>
      {children}
      {fieldErrors[name]?.[0] ? (
        <span className={classNames("text-sm", tone === "inverse" ? "text-rose-200" : "text-red-700")}>
          {fieldErrors[name]?.[0]}
        </span>
      ) : null}
    </label>
  );
}

function DataForm({
  state,
  onSubmit,
  submitLabel,
  children,
}: {
  state: FormState;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {children}
      <button className="w-full rounded-lg bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white sm:w-fit">
        {submitLabel}
      </button>
    </form>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-white/60 px-5 py-8 text-center">
      <h3 className="mx-auto max-w-[24ch] text-lg font-semibold text-balance">{title}</h3>
      <p className="mx-auto mt-2 max-w-[42ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">{copy}</p>
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "danger" | "success";
  children: React.ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "mt-4 rounded-lg border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700"
      : "mt-4 rounded-lg border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700";

  return <p className={styles}>{children}</p>;
}

function WarningPill({
  level,
  children,
}: {
  level: "info" | "warning" | "critical";
  children: React.ReactNode;
}) {
  const classes =
    level === "critical"
      ? "border-red-300/50 bg-red-50 text-red-700"
      : level === "warning"
        ? "border-amber-300/50 bg-amber-50 text-amber-700"
        : "border-sky-300/50 bg-sky-50 text-sky-700";

  return (
    <span className={classNames("rounded-md border px-3 py-1 text-xs font-semibold", classes)}>
      {children}
    </span>
  );
}

function SeedBatchCard({
  seedBatch,
  varietyName,
  warnings,
  germinationTests,
  adjustments,
  locale,
  t,
}: {
  seedBatch: SeedBatch;
  varietyName: string;
  warnings: NonNullable<SeedBatch["storageWarnings"]>;
  germinationTests: NonNullable<SeedBatch["germinationTests"]>;
  adjustments: NonNullable<SeedBatch["stockTransactions"]>;
  locale: Locale;
  t: AppMessages;
}) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{varietyName}</h3>
          <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.72)]">
            {seedBatch.quantity} {labelSeedUnit(seedBatch.unit, t).toLowerCase()} · {seedBatch.storageLocation || t.seedBatch.noStorageLocation}
          </p>
        </div>
        <span className="rounded-md bg-white px-3 py-1 text-xs font-semibold">
          {seedBatch.harvestYear ? `${t.seedBatch.harvestPrefix} ${seedBatch.harvestYear}` : t.seedBatch.yearUnknown}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {warnings.map((warning) => (
          <WarningPill key={`${seedBatch.id}-${warning.title}`} level={warning.level}>
            {getWarningTitle(warning.code, warning.title, t)}
          </WarningPill>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            {t.seedBatch.germinationTestsTitle}
          </p>
          <div className="mt-2 grid gap-2">
            {germinationTests.length ? (
              germinationTests.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-md bg-white px-3 py-3 text-sm">
                  <p className="font-medium">{formatDate(entry.testedAt, locale, t.common.notSet)}</p>
                  <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
                    {entry.germinatedCount}/{entry.sampleSize} {t.seedBatch.germinated}
                    {entry.germinationRate ? ` · ${entry.germinationRate}%` : ""}
                    {entry.notes ? ` · ${entry.notes}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-white px-3 py-3 text-sm text-[color:rgba(24,49,40,0.68)]">
                {t.seedBatch.noGerminationTests}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            {t.seedBatch.correctionHistoryTitle}
          </p>
          <div className="mt-2 grid gap-2">
            {adjustments.length ? (
              adjustments.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-md bg-white px-3 py-3 text-sm">
                  <p className="font-medium">{labelPlantingType(entry.type, t)}</p>
                  <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
                    {formatDate(entry.effectiveDate, locale, t.common.notSet)}
                    {entry.quantityDelta ? ` · ${t.seedBatch.delta} ${entry.quantityDelta}` : ""}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-md bg-white px-3 py-3 text-sm text-[color:rgba(24,49,40,0.68)]">
                {t.seedBatch.noCorrectionHistory}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function RuleGrid({
  form,
  setForm,
  t,
}: {
  form: RuleFormValues;
  setForm: React.Dispatch<React.SetStateAction<RuleFormValues>>;
  t: AppMessages;
}) {
  const groups: Array<{
    title: string;
    help: string;
    fields: Array<{ name: keyof RuleFormValues; label: string }>;
  }> = [
    {
      title: t.rules.indoorGroupTitle,
      help: t.rules.indoorGroupHelp,
      fields: [
        { name: "sowIndoorsStartWeeks", label: `${t.rules.windowStart} (${t.rules.weeksBefore})` },
        { name: "sowIndoorsEndWeeks", label: `${t.rules.windowEnd} (${t.rules.weeksBefore})` },
      ],
    },
    {
      title: t.rules.outdoorGroupTitle,
      help: t.rules.outdoorGroupHelp,
      fields: [
        { name: "sowOutdoorsStartWeeks", label: `${t.rules.windowStart} (${t.rules.weeksBefore})` },
        { name: "sowOutdoorsEndWeeks", label: `${t.rules.windowEnd} (${t.rules.weeksBefore})` },
      ],
    },
    {
      title: t.rules.transplantGroupTitle,
      help: t.rules.transplantGroupHelp,
      fields: [
        { name: "transplantStartWeeks", label: `${t.rules.windowStart} (${t.rules.weeksAfter})` },
        { name: "transplantEndWeeks", label: `${t.rules.windowEnd} (${t.rules.weeksAfter})` },
      ],
    },
    {
      title: t.rules.harvestGroupTitle,
      help: t.rules.harvestGroupHelp,
      fields: [
        { name: "harvestStartDays", label: `${t.rules.windowStart} (${t.rules.daysAfter})` },
        { name: "harvestEndDays", label: `${t.rules.windowEnd} (${t.rules.daysAfter})` },
      ],
    },
    {
      title: t.rules.spacingGroupTitle,
      help: t.rules.spacingGroupHelp,
      fields: [{ name: "spacingCm", label: t.forms.spacingCm }],
    },
    {
      title: t.rules.successionGroupTitle,
      help: t.rules.successionGroupHelp,
      fields: [{ name: "successionIntervalDays", label: t.forms.successionInterval }],
    },
  ];

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.title} className="rounded-lg border border-[var(--border)] bg-white/70 p-4">
          <div className="mb-4">
            <h3 className="text-base font-semibold">{group.title}</h3>
            <p className="mt-2 max-w-[44ch] text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
              {group.help}
            </p>
          </div>
          <div className={classNames("grid gap-4", group.fields.length > 1 && "md:grid-cols-2")}>
            {group.fields.map((field) => (
              <label key={field.name} className="grid gap-2 text-sm font-medium">
                <span>{field.label}</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  value={form[field.name]}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
