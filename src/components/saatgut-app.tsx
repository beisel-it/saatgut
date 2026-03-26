"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

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
import type {
  CalendarItem,
  DashboardData,
  SeedBatch,
  SessionSnapshot,
  Species,
} from "@/lib/client/types";

type AuthMode = "login" | "register";
type ViewId = "dashboard" | "catalog" | "profiles" | "rules" | "plantings";

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
const phenologyStages: Array<{ id: string; label: string; hint: string }> = [
  {
    id: "late-winter",
    label: "Late winter",
    hint: "Use when the season still behaves like winter and protection-first planning matters.",
  },
  {
    id: "first-spring",
    label: "First spring",
    hint: "Early flowering signals and soil wake-up. Good for cautious ramp-up.",
  },
  {
    id: "full-spring",
    label: "Full spring",
    hint: "Growth is reliable and sowing windows usually widen quickly.",
  },
  {
    id: "early-summer",
    label: "Early summer",
    hint: "Transplanting and first harvests overlap. Watch water stress.",
  },
  {
    id: "high-summer",
    label: "High summer",
    hint: "Peak growth and harvest period. Storage and succession timing matter most.",
  },
  {
    id: "late-summer",
    label: "Late summer",
    hint: "Seed saving and autumn succession decisions become more important.",
  },
  {
    id: "early-autumn",
    label: "Early autumn",
    hint: "Shift attention to final harvests, seed cleanup, and storage checks.",
  },
];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function toIsoDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCalendarDate(item: CalendarItem) {
  if (item.kind === "window") return formatDate(item.recommendedDate);
  if (item.kind === "recorded") return formatDate(item.date);
  return formatDate(item.dateStart);
}

function labelPlantingType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeCalendarItem(item: CalendarItem) {
  if (item.kind === "window") {
    return `${item.speciesName} · ${formatDate(item.windowStart)} to ${formatDate(item.windowEnd)}`;
  }

  if (item.kind === "recorded") {
    return `${labelPlantingType(item.event.type)} recorded`;
  }

  return item.dateEnd
    ? `${formatDate(item.dateStart)} to ${formatDate(item.dateEnd)}`
    : formatDate(item.dateStart);
}

function toFormState(error: unknown): FormState {
  if (error instanceof ApiClientError) {
    return {
      error: error.message,
      success: null,
      fieldErrors: error.fieldErrors,
    };
  }

  return {
    error: error instanceof Error ? error.message : "Something went wrong.",
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

function nullableRange(start: number | null, end: number | null, suffix: string) {
  if (start === null && end === null) return "Not defined";
  if (start !== null && end !== null) return `${start} to ${end} ${suffix}`;
  return `${start ?? end} ${suffix}`;
}

export function SaatgutApp() {
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [view, setView] = useState<ViewId>("dashboard");
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<FormState>(initialFormState);
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
          setSessionError(error instanceof Error ? error.message : "Failed to load session.");
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
  }, []);

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
        .catch((error) => setAuthState(toFormState(error)));
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
        .catch((error) => setAuthState(toFormState(error)));
    });
  }

  async function handleLogout() {
    setSessionError(null);

    startAuthTransition(() => {
      void logoutUser()
        .then(() => {
          setSession(null);
          setDashboard(null);
          setView("dashboard");
        })
        .catch((error) =>
          setSessionError(error instanceof Error ? error.message : "Failed to log out."),
        );
    });
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
      setSpeciesState({ error: null, success: "Species saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setSpeciesState(toFormState(error));
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
      setVarietyState({ error: null, success: "Variety saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setVarietyState(toFormState(error));
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
      setSeedBatchState({ error: null, success: "Seed batch saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setSeedBatchState(toFormState(error));
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
      setProfileState({ error: null, success: "Growing profile saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setProfileState(toFormState(error));
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
      setRuleState({ error: null, success: "Cultivation rule saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setRuleState(toFormState(error));
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
      setPlantingState({ error: null, success: "Planting event saved.", fieldErrors: {} });
      await loadDashboard();
    } catch (error) {
      setPlantingState(toFormState(error));
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
        success: "Germination test logged.",
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setGerminationState(toFormState(error));
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
        success: "Stock correction applied.",
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setCorrectionState(toFormState(error));
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
        success: "Correction reversal applied.",
        fieldErrors: {},
      });
      await loadDashboard();
    } catch (error) {
      setCorrectionState(toFormState(error));
    }
  }

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(127,155,71,0.18),transparent_30%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-[var(--border)] bg-white/70 p-10 shadow-[var(--shadow)]">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--accent-strong)]">
            Saatgut
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Loading your workspace…</h1>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,155,71,0.22),transparent_32%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-8 shadow-[var(--shadow)] md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--accent-strong)]">
              Saatgut
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              Run your seed bank, calendar, and batch quality decisions from one field-ready workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[color:rgba(24,49,40,0.78)] md:text-lg">
              Sign in to manage varieties, storage-sensitive seed batches, frost-date planning,
              germination checks, and stock history without returning to paper notes.
            </p>
          </section>

          <section className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(24,49,40,0.94)] p-6 text-white shadow-[var(--shadow)] md:p-8">
            <div className="inline-flex rounded-full bg-white/10 p-1 text-sm">
              <button
                type="button"
                className={classNames(
                  "rounded-full px-4 py-2 transition",
                  authMode === "register" && "bg-white text-[var(--foreground)]",
                )}
                onClick={() => {
                  setAuthMode("register");
                  setAuthState(initialFormState);
                }}
              >
                Create workspace
              </button>
              <button
                type="button"
                className={classNames(
                  "rounded-full px-4 py-2 transition",
                  authMode === "login" && "bg-white text-[var(--foreground)]",
                )}
                onClick={() => {
                  setAuthMode("login");
                  setAuthState(initialFormState);
                }}
              >
                Sign in
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-semibold">
                {authMode === "register" ? "Set up your garden workspace" : "Return to your workspace"}
              </h2>
            </div>

            {sessionError ? <Alert tone="danger">{sessionError}</Alert> : null}
            {authState.error ? <Alert tone="danger">{authState.error}</Alert> : null}

            {authMode === "register" ? (
              <form className="mt-6 grid gap-4" onSubmit={handleRegister}>
                <Field label="Email" name="email" fieldErrors={authState.fieldErrors}>
                  <input
                    className="field-input-dark"
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Password" name="password" fieldErrors={authState.fieldErrors}>
                  <input
                    className="field-input-dark"
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Workspace name" name="workspaceName" fieldErrors={authState.fieldErrors} optional>
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
                <button className="rounded-full bg-white px-5 py-3 font-semibold text-[var(--foreground)]" disabled={authPending}>
                  {authPending ? "Creating workspace…" : "Create workspace"}
                </button>
              </form>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={handleLogin}>
                <Field label="Email" name="email" fieldErrors={authState.fieldErrors}>
                  <input
                    className="field-input-dark"
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Password" name="password" fieldErrors={authState.fieldErrors}>
                  <input
                    className="field-input-dark"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </Field>
                <button className="rounded-full bg-white px-5 py-3 font-semibold text-[var(--foreground)]" disabled={authPending}>
                  {authPending ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    );
  }

  const dashboardStats = [
    { label: "Species", value: dashboard?.species.length ?? 0 },
    { label: "Varieties", value: dashboard?.varieties.length ?? 0 },
    { label: "Seed batches", value: dashboard?.seedBatches.length ?? 0 },
    { label: "14-day items", value: dashboard?.calendar.length ?? 0 },
    {
      label: "Quality signals",
      value: (dashboard?.seedBatches ?? []).reduce(
        (sum, seedBatch) =>
          sum +
          (seedBatch.germinationTests?.length ? 1 : 0) +
          ((seedBatch.stockTransactions?.filter((transaction) => transaction.type !== "INITIAL_STOCK").length ?? 0) > 0 ? 1 : 0),
        0,
      ),
    },
    { label: "Critical storage flags", value: criticalBatchCount },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,155,71,0.18),transparent_28%),linear-gradient(180deg,#e8e1cf_0%,#f4efe3_100%)] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(24,49,40,0.96)] p-5 text-white shadow-[var(--shadow)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/65">Saatgut</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{session.membership.workspace.name}</h1>
          <p className="mt-2 text-sm text-white/70">
            {session.user.email} · {session.membership.role.toLowerCase()}
          </p>

          <nav className="mt-8 grid gap-2">
            {[
              ["dashboard", "Dashboard"],
              ["catalog", "Catalog"],
              ["profiles", "Profiles"],
              ["rules", "Rules"],
              ["plantings", "Plantings"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id as ViewId)}
                className={classNames(
                  "rounded-2xl px-4 py-3 text-left text-sm font-medium transition",
                  view === id ? "bg-white text-[var(--foreground)]" : "bg-white/6 text-white/84 hover:bg-white/10",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Active profile</p>
            <p className="mt-2 text-lg font-semibold">{activeProfile ? activeProfile.name : "None selected"}</p>
            <p className="mt-1 text-sm text-white/68">
              {activeProfile
                ? `Last frost ${formatDate(activeProfile.lastFrostDate)}`
                : "Create an active profile to unlock the calendar."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 w-full rounded-full border border-white/14 px-4 py-3 text-sm font-semibold text-white/88"
            disabled={authPending}
          >
            {authPending ? "Signing out…" : "Sign out"}
          </button>
        </aside>

        <section className="space-y-4">
          <header className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--accent-strong)]">
                  Batch care and planning follow-up
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
                  Use journal-backed quality signals, correction logs, and profile guidance without leaving the workspace.
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  startRefreshTransition(() => {
                    void loadDashboard().catch((error) => {
                      setSessionError(error instanceof Error ? error.message : "Failed to refresh data.");
                    });
                  })
                }
                className="rounded-full border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold"
                disabled={refreshPending}
              >
                {refreshPending ? "Refreshing…" : "Refresh workspace"}
              </button>
            </div>

            {sessionError ? <Alert tone="danger">{sessionError}</Alert> : null}
          </header>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {dashboardStats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-[1.5rem] border border-[var(--border)] bg-white/80 p-5 shadow-[var(--shadow)]"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-[color:rgba(24,49,40,0.58)]">
                  {stat.label}
                </p>
                <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              </article>
            ))}
          </div>

          {view === "dashboard" ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Panel title="14-day calendar" subtitle="Upcoming windows, recorded work, and harvest estimates.">
                {dashboard?.calendar.length ? (
                  <div className="grid gap-3">
                    {dashboard.calendar.map((item, index) => (
                      <article
                        key={`${item.kind}-${index}`}
                        className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                              {item.kind}
                            </p>
                            <h3 className="mt-1 text-lg font-semibold">
                              {item.kind === "window"
                                ? `${item.label} · ${item.varietyName}`
                                : item.kind === "recorded"
                                  ? `${labelPlantingType(item.event.type)} · ${item.varietyName}`
                                  : `${item.label} · ${item.varietyName}`}
                            </h3>
                          </div>
                          <p className="rounded-full bg-white px-3 py-1 text-sm font-medium">
                            {formatCalendarDate(item)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">
                          {summarizeCalendarItem(item)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No calendar items yet"
                    copy="Add an active growing profile and cultivation rules to calculate the next 14 days."
                  />
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Seed quality watch" subtitle="Client-side warnings from batch age, storage notes, and journal history.">
                  {dashboard?.seedBatches.length ? (
                    <div className="grid gap-3">
                      {dashboard.seedBatches.slice(0, 5).map((seedBatch) => {
                        const warnings = storageWarningsByBatch.get(seedBatch.id) ?? [];
                        const variety = varietiesById.get(seedBatch.varietyId);

                        return (
                          <article
                            key={seedBatch.id}
                            className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-base font-semibold">{variety?.name ?? "Unknown variety"}</h3>
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                                {warnings.filter((warning) => warning.level !== "info").length} flags
                              </span>
                            </div>
                            <div className="mt-3 grid gap-2">
                              {warnings.slice(0, 2).map((warning) => (
                                <WarningPill key={warning.title} level={warning.level}>
                                  {warning.title}
                                </WarningPill>
                              ))}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="No batch warnings yet" copy="Create seed batches to surface quality and storage insights." />
                  )}
                </Panel>

                <Panel title="Batch signals" subtitle="Latest germination tests and stock adjustment notes from the explicit seed-quality contract.">
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
                            title: `Germination ${test.germinationRate ?? "?"}%`,
                            subtitle: `${varietiesById.get(seedBatch.varietyId)?.name ?? "Batch"} · ${formatDate(test.testedAt)}`,
                          })),
                          ...(seedBatch.stockTransactions ?? [])
                            .filter((transaction) => transaction.type !== "INITIAL_STOCK")
                            .slice(0, 1)
                            .map((transaction) => ({
                              key: transaction.id,
                              title: labelPlantingType(transaction.type),
                              subtitle: `${varietiesById.get(seedBatch.varietyId)?.name ?? "Batch"} · ${formatDate(transaction.effectiveDate)}`,
                            })),
                        ])
                        .slice(0, 8)
                        .map((entry) => (
                        <article
                          key={entry.key}
                          className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
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
                      title="No quality journal entries"
                      copy="Record germination tests or stock corrections to build a clearer seed history."
                    />
                  )}
                </Panel>
              </div>
            </div>
          ) : null}

          {view === "catalog" ? (
            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4">
                <Panel title="Species" subtitle="Create the crop types your varieties belong to.">
                  <DataForm state={speciesState} onSubmit={submitSpecies} submitLabel="Save species">
                    <Field label="Common name" name="commonName" fieldErrors={speciesState.fieldErrors}>
                      <input
                        className="field-input"
                        value={speciesForm.commonName}
                        onChange={(event) =>
                          setSpeciesForm((current) => ({ ...current, commonName: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Latin name" name="latinName" fieldErrors={speciesState.fieldErrors} optional>
                      <input
                        className="field-input"
                        value={speciesForm.latinName}
                        onChange={(event) =>
                          setSpeciesForm((current) => ({ ...current, latinName: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Category" name="category" fieldErrors={speciesState.fieldErrors}>
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
                            {category}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Notes" name="notes" fieldErrors={speciesState.fieldErrors} optional>
                      <textarea
                        className="field-input min-h-24"
                        value={speciesForm.notes}
                        onChange={(event) =>
                          setSpeciesForm((current) => ({ ...current, notes: event.target.value }))
                        }
                      />
                    </Field>
                  </DataForm>
                </Panel>

                <Panel title="Varieties" subtitle="Attach heirloom notes, tags, synonyms, and species links.">
                  <DataForm state={varietyState} onSubmit={submitVariety} submitLabel="Save variety">
                    <Field label="Species" name="speciesId" fieldErrors={varietyState.fieldErrors}>
                      <select
                        className="field-input"
                        value={varietyForm.speciesId}
                        onChange={(event) =>
                          setVarietyForm((current) => ({ ...current, speciesId: event.target.value }))
                        }
                      >
                        <option value="">Select species</option>
                        {(dashboard?.species ?? []).map((species) => (
                          <option key={species.id} value={species.id}>
                            {species.commonName}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Variety name" name="name" fieldErrors={varietyState.fieldErrors}>
                      <input
                        className="field-input"
                        value={varietyForm.name}
                        onChange={(event) =>
                          setVarietyForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Tags" name="tags" fieldErrors={varietyState.fieldErrors} optional>
                      <input
                        className="field-input"
                        value={varietyForm.tags}
                        onChange={(event) =>
                          setVarietyForm((current) => ({ ...current, tags: event.target.value }))
                        }
                        placeholder="heirloom, seed-saving, greenhouse"
                      />
                    </Field>
                    <Field label="Synonyms" name="synonyms" fieldErrors={varietyState.fieldErrors} optional>
                      <input
                        className="field-input"
                        value={varietyForm.synonyms}
                        onChange={(event) =>
                          setVarietyForm((current) => ({ ...current, synonyms: event.target.value }))
                        }
                        placeholder="Comma-separated"
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
                      Heirloom or conservation variety
                    </label>
                    <Field label="Description" name="description" fieldErrors={varietyState.fieldErrors} optional>
                      <textarea
                        className="field-input min-h-24"
                        value={varietyForm.description}
                        onChange={(event) =>
                          setVarietyForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </Field>
                  </DataForm>
                </Panel>
              </div>

              <div className="space-y-4">
                <Panel title="Seed batches" subtitle="Track stock, record germination tests, apply corrections, and reverse them when needed.">
                  <DataForm state={seedBatchState} onSubmit={submitSeedBatch} submitLabel="Save seed batch">
                    <Field label="Variety" name="varietyId" fieldErrors={seedBatchState.fieldErrors}>
                      <select
                        className="field-input"
                        value={seedBatchForm.varietyId}
                        onChange={(event) =>
                          setSeedBatchForm((current) => ({ ...current, varietyId: event.target.value }))
                        }
                      >
                        <option value="">Select variety</option>
                        {(dashboard?.varieties ?? []).map((variety) => (
                          <option key={variety.id} value={variety.id}>
                            {variety.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Quantity" name="quantity" fieldErrors={seedBatchState.fieldErrors}>
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
                      <Field label="Unit" name="unit" fieldErrors={seedBatchState.fieldErrors}>
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
                              {unit}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Harvest year" name="harvestYear" fieldErrors={seedBatchState.fieldErrors} optional>
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
                      <Field label="Source" name="source" fieldErrors={seedBatchState.fieldErrors} optional>
                        <input
                          className="field-input"
                          value={seedBatchForm.source}
                          onChange={(event) =>
                            setSeedBatchForm((current) => ({ ...current, source: event.target.value }))
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Storage location" name="storageLocation" fieldErrors={seedBatchState.fieldErrors} optional>
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

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <DataForm state={germinationState} onSubmit={submitGermination} submitLabel="Log germination test">
                      <Field label="Seed batch" name="seedBatchId" fieldErrors={germinationState.fieldErrors}>
                        <select
                          className="field-input"
                          value={germinationForm.seedBatchId}
                          onChange={(event) =>
                            setGerminationForm((current) => ({ ...current, seedBatchId: event.target.value }))
                          }
                        >
                          <option value="">Select batch</option>
                          {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                            <option key={seedBatch.id} value={seedBatch.id}>
                              {(varietiesById.get(seedBatch.varietyId)?.name ?? "Batch")} · {seedBatch.quantity} {seedBatch.unit.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Test date" name="entryDate" fieldErrors={germinationState.fieldErrors}>
                        <input
                          className="field-input"
                          type="date"
                          value={germinationForm.entryDate}
                          onChange={(event) =>
                            setGerminationForm((current) => ({ ...current, entryDate: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Sample size" name="sampleSize" fieldErrors={germinationState.fieldErrors}>
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
                      <Field label="Germinated count" name="germinatedCount" fieldErrors={germinationState.fieldErrors}>
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
                      <Field label="Result notes" name="details" fieldErrors={germinationState.fieldErrors} optional>
                        <textarea
                          className="field-input min-h-24"
                          value={germinationForm.notes}
                          onChange={(event) =>
                            setGerminationForm((current) => ({ ...current, notes: event.target.value }))
                          }
                          placeholder="Example: 8/10 germinated after 6 days."
                        />
                      </Field>
                    </DataForm>

                    <DataForm state={correctionState} onSubmit={submitCorrection} submitLabel="Apply correction">
                      <Field label="Seed batch" name="seedBatchId" fieldErrors={correctionState.fieldErrors}>
                        <select
                          className="field-input"
                          value={correctionForm.seedBatchId}
                          onChange={(event) =>
                            setCorrectionForm((current) => ({ ...current, seedBatchId: event.target.value }))
                          }
                        >
                          <option value="">Select batch</option>
                          {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                            <option key={seedBatch.id} value={seedBatch.id}>
                              {(varietiesById.get(seedBatch.varietyId)?.name ?? "Batch")} · {seedBatch.quantity} {seedBatch.unit.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Mode" name="mode" fieldErrors={correctionState.fieldErrors}>
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
                            <option value="ADJUST_DELTA">Adjust by delta</option>
                            <option value="SET_ABSOLUTE">Set absolute quantity</option>
                          </select>
                        </Field>
                        <Field label="Entry date" name="entryDate" fieldErrors={correctionState.fieldErrors}>
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
                      <Field label="Quantity referenced" name="quantity" fieldErrors={correctionState.fieldErrors} optional>
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
                      <Field label="Reason" name="reason" fieldErrors={correctionState.fieldErrors}>
                        <textarea
                          className="field-input min-h-24"
                          value={correctionForm.reason}
                          onChange={(event) =>
                            setCorrectionForm((current) => ({ ...current, reason: event.target.value }))
                          }
                          placeholder="Example: corrected after recount or reconciled against stored packets."
                        />
                      </Field>
                    </DataForm>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-[var(--border)] bg-white/70 p-4">
                    <h3 className="text-lg font-semibold">Reverse a correction</h3>
                    <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.68)]">
                      Reverse a manual correction transaction when it should not have changed stock.
                    </p>
                    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submitReversal}>
                      <Field label="Seed batch" name="seedBatchId" fieldErrors={correctionState.fieldErrors}>
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
                          <option value="">Select batch</option>
                          {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                            <option key={seedBatch.id} value={seedBatch.id}>
                              {(varietiesById.get(seedBatch.varietyId)?.name ?? "Batch")} · {seedBatch.quantity} {seedBatch.unit.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Correction transaction" name="transactionId" fieldErrors={correctionState.fieldErrors}>
                        <select
                          className="field-input"
                          value={reversalForm.transactionId}
                          onChange={(event) =>
                            setReversalForm((current) => ({ ...current, transactionId: event.target.value }))
                          }
                        >
                          <option value="">Select correction</option>
                          {((dashboard?.seedBatches ?? []).find((seedBatch) => seedBatch.id === reversalForm.seedBatchId)
                            ?.stockTransactions ?? [])
                            .filter(
                              (transaction) =>
                                transaction.type === "MANUAL_CORRECTION" && !transaction.reversalOfId,
                            )
                            .map((transaction) => (
                              <option key={transaction.id} value={transaction.id}>
                                {formatDate(transaction.effectiveDate)} · {transaction.quantityDelta}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Reversal date" name="entryDate" fieldErrors={correctionState.fieldErrors}>
                        <input
                          className="field-input"
                          type="date"
                          value={reversalForm.entryDate}
                          onChange={(event) =>
                            setReversalForm((current) => ({ ...current, entryDate: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Reason" name="reason" fieldErrors={correctionState.fieldErrors}>
                        <input
                          className="field-input"
                          value={reversalForm.reason}
                          onChange={(event) =>
                            setReversalForm((current) => ({ ...current, reason: event.target.value }))
                          }
                        />
                      </Field>
                      <button className="w-fit rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white">
                        Reverse correction
                      </button>
                    </form>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {(dashboard?.seedBatches ?? []).map((seedBatch) => (
                      <SeedBatchCard
                        key={seedBatch.id}
                        seedBatch={seedBatch}
                        varietyName={varietiesById.get(seedBatch.varietyId)?.name ?? "Unknown variety"}
                        warnings={storageWarningsByBatch.get(seedBatch.id) ?? []}
                        germinationTests={seedBatch.germinationTests ?? []}
                        adjustments={seedBatch.stockTransactions?.filter((transaction) => transaction.type !== "INITIAL_STOCK") ?? []}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          ) : null}

          {view === "profiles" ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Growing profiles" subtitle="Manage frost dates and set persisted phenology state for local seasonal context.">
                <DataForm state={profileState} onSubmit={submitProfile} submitLabel="Save profile">
                  <Field label="Profile name" name="name" fieldErrors={profileState.fieldErrors}>
                    <input
                      className="field-input"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Last frost date" name="lastFrostDate" fieldErrors={profileState.fieldErrors}>
                      <input
                        className="field-input"
                        type="date"
                        value={profileForm.lastFrostDate}
                        onChange={(event) =>
                          setProfileForm((current) => ({ ...current, lastFrostDate: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="First frost date" name="firstFrostDate" fieldErrors={profileState.fieldErrors}>
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
                    Mark as active planning profile
                  </label>
                  <Field label="Notes" name="notes" fieldErrors={profileState.fieldErrors} optional>
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
                <Panel title="Phenology helper" subtitle="Optional local state to reality-check the frost profile with what the garden is actually doing.">
                  <div className="grid gap-3 md:grid-cols-2">
                    {phenologyStages.map((stage) => (
                      <article
                        key={stage.id}
                        className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <h3 className="text-base font-semibold">{stage.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{stage.hint}</p>
                      </article>
                    ))}
                  </div>
                </Panel>

                <Panel title="Profile summary" subtitle="The calendar uses the active profile, and phenology is now persisted on the profile contract.">
                  {dashboard?.profiles.length ? (
                    <div className="grid gap-3">
                      {dashboard.profiles.map((profile) => (
                        <article
                          key={profile.id}
                          className={classNames(
                            "rounded-[1.25rem] border px-4 py-4",
                            profile.isActive
                              ? "border-[var(--accent)] bg-[color:rgba(127,155,71,0.12)]"
                              : "border-[var(--border)] bg-[var(--muted)]",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold">{profile.name}</h3>
                            {profile.isActive ? (
                              <span className="rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-semibold text-white">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">
                            Last frost {formatDate(profile.lastFrostDate)} · First frost {formatDate(profile.firstFrostDate)}
                          </p>
                          <div className="mt-4 grid gap-2">
                            <label className="grid gap-2 text-sm font-medium">
                              <span>Observed phenology stage</span>
                              <select
                                className="field-input"
                                value={profile.phenologyStage ?? ""}
                                onChange={(event) => {
                                  void updateProfilePhenology(profile.id, {
                                    phenologyStage: event.target.value || null,
                                    phenologyObservedAt: new Date().toISOString(),
                                    phenologyNotes: profile.phenologyNotes ?? null,
                                  }).then(loadDashboard).catch((error) => setProfileState(toFormState(error)));
                                }}
                              >
                                <option value="">None</option>
                                {phenologyStages.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                              <p className="text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">
                              {phenologyStages.find((stage) => stage.id === profile.phenologyStage)?.hint ??
                                "Use phenology only as a reality-check against frost-date assumptions."}
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2">
                            <label className="grid gap-2 text-sm font-medium">
                              <span>Phenology notes</span>
                              <textarea
                                className="field-input min-h-20"
                                value={profile.phenologyNotes ?? ""}
                                onChange={(event) => {
                                  void updateProfilePhenology(profile.id, {
                                    phenologyStage: profile.phenologyStage ?? null,
                                    phenologyObservedAt: profile.phenologyObservedAt ?? new Date().toISOString(),
                                    phenologyNotes: event.target.value || null,
                                  }).then(loadDashboard).catch((error) => setProfileState(toFormState(error)));
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
                      title="No growing profiles yet"
                      copy="Create one active profile before expecting calendar windows or transplant timing."
                    />
                  )}
                </Panel>
              </div>
            </div>
          ) : null}

          {view === "rules" ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Cultivation rules" subtitle="Define frost-relative windows and harvest timing per variety.">
                <DataForm state={ruleState} onSubmit={submitRule} submitLabel="Save rule">
                  <Field label="Variety" name="varietyId" fieldErrors={ruleState.fieldErrors}>
                    <select
                      className="field-input"
                      value={ruleForm.varietyId}
                      onChange={(event) =>
                        setRuleForm((current) => ({ ...current, varietyId: event.target.value }))
                      }
                    >
                      <option value="">Select variety</option>
                      {(dashboard?.varieties ?? []).map((variety) => (
                        <option key={variety.id} value={variety.id}>
                          {variety.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <RuleGrid form={ruleForm} setForm={setRuleForm} />
                </DataForm>
              </Panel>

              <Panel title="Current rules" subtitle="Review the planning logic currently feeding the 14-day list.">
                {dashboard?.rules.length ? (
                  <div className="grid gap-3">
                    {dashboard.rules.map((rule) => (
                      <article
                        key={rule.id}
                        className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <h3 className="text-lg font-semibold">{rule.variety.name}</h3>
                        <div className="mt-3 grid gap-2 text-sm text-[color:rgba(24,49,40,0.72)] md:grid-cols-2">
                          <p>Indoor sowing: {nullableRange(rule.sowIndoorsStartWeeks, rule.sowIndoorsEndWeeks, "weeks before")}</p>
                          <p>Outdoor sowing: {nullableRange(rule.sowOutdoorsStartWeeks, rule.sowOutdoorsEndWeeks, "weeks before")}</p>
                          <p>Transplant: {nullableRange(rule.transplantStartWeeks, rule.transplantEndWeeks, "weeks after")}</p>
                          <p>Harvest: {nullableRange(rule.harvestStartDays, rule.harvestEndDays, "days after")}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No rules saved yet"
                    copy="Add at least one cultivation rule to unlock calendar windows and harvest projections."
                  />
                )}
              </Panel>
            </div>
          ) : null}

          {view === "plantings" ? (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Panel title="Planting events" subtitle="Log sowing, transplanting, and harvest actions with optional stock deduction.">
                <DataForm state={plantingState} onSubmit={submitPlanting} submitLabel="Save planting event">
                  <Field label="Variety" name="varietyId" fieldErrors={plantingState.fieldErrors}>
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
                      <option value="">Select variety</option>
                      {(dashboard?.varieties ?? []).map((variety) => (
                        <option key={variety.id} value={variety.id}>
                          {variety.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Type" name="type" fieldErrors={plantingState.fieldErrors}>
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
                            {labelPlantingType(type)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Growing profile" name="growingProfileId" fieldErrors={plantingState.fieldErrors} optional>
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
                        <option value="">None</option>
                        {(dashboard?.profiles ?? []).map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Seed batch" name="seedBatchId" fieldErrors={plantingState.fieldErrors} optional>
                      <select
                        className="field-input"
                        value={plantingForm.seedBatchId}
                        onChange={(event) =>
                          setPlantingForm((current) => ({ ...current, seedBatchId: event.target.value }))
                        }
                      >
                        <option value="">None</option>
                        {seedBatchesForSelectedVariety.map((seedBatch) => (
                          <option key={seedBatch.id} value={seedBatch.id}>
                            {(varietiesById.get(seedBatch.varietyId)?.name ?? "Batch")} · {seedBatch.quantity} {seedBatch.unit.toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantity used" name="quantityUsed" fieldErrors={plantingState.fieldErrors} optional>
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
                    <Field label="Planned date" name="plannedDate" fieldErrors={plantingState.fieldErrors} optional>
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
                    <Field label="Actual date" name="actualDate" fieldErrors={plantingState.fieldErrors} optional>
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
                  <Field label="Location note" name="locationNote" fieldErrors={plantingState.fieldErrors} optional>
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

              <Panel title="Event ledger" subtitle="Recent entries and quantity-aware planting history.">
                {dashboard?.plantings.length ? (
                  <div className="grid gap-3">
                    {dashboard.plantings.map((event) => (
                      <article
                        key={event.id}
                        className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-base font-semibold">
                            {varietiesById.get(event.varietyId)?.name ?? "Unknown variety"}
                          </h3>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
                            {labelPlantingType(event.type)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">
                          {event.actualDate ? `Actual ${formatDate(event.actualDate)}` : `Planned ${formatDate(event.plannedDate)}`}
                          {event.quantityUsed ? ` · Used ${event.quantityUsed}` : ""}
                        </p>
                        {event.locationNote ? (
                          <p className="mt-2 text-sm text-[color:rgba(24,49,40,0.72)]">{event.locationNote}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No planting ledger entries"
                    copy="Log an event to track work completed and deduct seed stock where relevant."
                  />
                )}
              </Panel>
            </div>
          ) : null}
        </section>
      </div>
    </main>
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
    <section className="rounded-[2rem] border border-[var(--border)] bg-[color:rgba(253,249,240,0.92)] p-5 shadow-[var(--shadow)] md:p-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.72)]">{subtitle}</p>
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
  children,
}: {
  label: string;
  name: string;
  fieldErrors: Record<string, string[] | undefined>;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
      <span className="flex items-center gap-2">
        {label}
        {optional ? <span className="text-xs font-normal text-[color:rgba(24,49,40,0.56)]">Optional</span> : null}
      </span>
      {children}
      {fieldErrors[name]?.[0] ? (
        <span className="text-sm text-red-700">{fieldErrors[name]?.[0]}</span>
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
      <button className="w-fit rounded-full bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-white">
        {submitLabel}
      </button>
    </form>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[var(--border)] bg-white/60 px-5 py-8 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[color:rgba(24,49,40,0.68)]">{copy}</p>
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
      ? "mt-4 rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700"
      : "mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700";

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
    <span className={classNames("rounded-full border px-3 py-1 text-xs font-semibold", classes)}>
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
}: {
  seedBatch: SeedBatch;
  varietyName: string;
  warnings: NonNullable<SeedBatch["storageWarnings"]>;
  germinationTests: NonNullable<SeedBatch["germinationTests"]>;
  adjustments: NonNullable<SeedBatch["stockTransactions"]>;
}) {
  return (
    <article className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--muted)] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{varietyName}</h3>
          <p className="mt-1 text-sm text-[color:rgba(24,49,40,0.72)]">
            {seedBatch.quantity} {seedBatch.unit.toLowerCase()} · {seedBatch.storageLocation || "No storage location"}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
          {seedBatch.harvestYear ? `Harvest ${seedBatch.harvestYear}` : "Year unknown"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {warnings.map((warning) => (
          <WarningPill key={`${seedBatch.id}-${warning.title}`} level={warning.level}>
            {warning.title}
          </WarningPill>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            Germination tests
          </p>
          <div className="mt-2 grid gap-2">
            {germinationTests.length ? (
              germinationTests.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-xl bg-white px-3 py-3 text-sm">
                  <p className="font-medium">{formatDate(entry.testedAt)}</p>
                  <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
                    {entry.germinatedCount}/{entry.sampleSize} germinated
                    {entry.germinationRate ? ` · ${entry.germinationRate}%` : ""}
                    {entry.notes ? ` · ${entry.notes}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-white px-3 py-3 text-sm text-[color:rgba(24,49,40,0.68)]">
                No germination tests recorded yet.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
            Corrections and undo history
          </p>
          <div className="mt-2 grid gap-2">
            {adjustments.length ? (
              adjustments.slice(0, 2).map((entry) => (
                <div key={entry.id} className="rounded-xl bg-white px-3 py-3 text-sm">
                  <p className="font-medium">{labelPlantingType(entry.type)}</p>
                  <p className="mt-1 text-[color:rgba(24,49,40,0.72)]">
                    {formatDate(entry.effectiveDate)}
                    {entry.quantityDelta ? ` · delta ${entry.quantityDelta}` : ""}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-white px-3 py-3 text-sm text-[color:rgba(24,49,40,0.68)]">
                No correction history recorded.
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
}: {
  form: RuleFormValues;
  setForm: React.Dispatch<React.SetStateAction<RuleFormValues>>;
}) {
  const fields: Array<[keyof RuleFormValues, string]> = [
    ["sowIndoorsStartWeeks", "Indoor sowing start"],
    ["sowIndoorsEndWeeks", "Indoor sowing end"],
    ["sowOutdoorsStartWeeks", "Outdoor sowing start"],
    ["sowOutdoorsEndWeeks", "Outdoor sowing end"],
    ["transplantStartWeeks", "Transplant start"],
    ["transplantEndWeeks", "Transplant end"],
    ["harvestStartDays", "Harvest start"],
    ["harvestEndDays", "Harvest end"],
    ["spacingCm", "Spacing cm"],
    ["successionIntervalDays", "Succession interval"],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map(([name, label]) => (
        <label key={name} className="grid gap-2 text-sm font-medium">
          <span>{label}</span>
          <input
            className="field-input"
            type="number"
            min="0"
            value={form[name]}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                [name]: event.target.value,
              }))
            }
          />
        </label>
      ))}
    </div>
  );
}
