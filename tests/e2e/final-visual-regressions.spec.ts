import { expect, test, type Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, stamp: string) {
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `final-visual-${stamp}@example.com`,
      password: "correct horse battery staple",
      workspaceName: `Final Visual ${stamp}`,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function browserPost<T>(page: Page, baseURL: string, path: string, data: unknown) {
  const response = await page.context().request.post(`${baseURL}${path}`, {
    data,
  });

  expect(response.ok(), `${path} should succeed`).toBeTruthy();

  return (await response.json()) as T;
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 4);
}

test("visual sprint keeps catalog hierarchy and relaxed management layouts intact", async ({ page, baseURL }) => {
  const stamp = Date.now().toString();

  await registerWorkspace(page, baseURL!, stamp);

  const tomato = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/species", {
    commonName: "Tomate",
    latinName: "Solanum lycopersicum",
    category: "VEGETABLE",
    notes: "Warme Kultur mit vielen Sorten und mehreren Chargen.",
  });

  const lettuce = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/species", {
    commonName: "Salat",
    latinName: "Lactuca sativa",
    category: "VEGETABLE",
    notes: "Schnelle Folgesaetze.",
  });

  const blackCherry = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/varieties", {
    speciesId: tomato.id,
    name: "Black Cherry",
    description: "Kraeftige Cocktailtomate mit dichter Pflegehistorie.",
    heirloom: true,
    tags: ["frischverzehr", "gewaechshaus"],
    notes: "Starkwuechsig.",
    germinationDaysMin: 6,
    germinationDaysMax: 10,
    preferredSite: "Vollsonniger luftiger Gewaechshausplatz.",
    companionNotes: "Gute Nachbarn: Basilikum, Ringelblume.",
    companionIds: [],
  });

  await browserPost(page, baseURL!, "/api/v1/varieties", {
    speciesId: tomato.id,
    name: "Roma VF",
    description: "Dichte Flaschentomate fuer Sauce.",
    heirloom: false,
    tags: ["lager", "sauce"],
    notes: "Ertragreich.",
  });

  await browserPost(page, baseURL!, "/api/v1/varieties", {
    speciesId: lettuce.id,
    name: "Maikoenigin",
    description: "Frueher Kopfsalat fuer Satzanbau.",
    heirloom: true,
    tags: ["fruehjahr"],
    notes: "Mehrere Saatstufen.",
  });

  const seedBatchA = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/seed-batches", {
    varietyId: blackCherry.id,
    source: "Biohof Umland",
    harvestYear: 2024,
    quantity: 38,
    unit: "SEEDS",
    storageLocation: "Regal A1",
    notes: "Offene Tuete, hohe Prioritaet.",
  });

  const seedBatchB = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/seed-batches", {
    varietyId: blackCherry.id,
    source: "Tauschboerse Nord",
    harvestYear: 2023,
    quantity: 16,
    unit: "SEEDS",
    storageLocation: "Regal A1",
    notes: "Schwaechere Reservecharge.",
  });

  await browserPost(page, baseURL!, `/api/v1/seed-batches/${seedBatchA.id}/germination-tests`, {
    testedAt: "2026-01-14T00:00:00.000Z",
    sampleSize: 12,
    germinatedCount: 10,
    notes: "Keimt gut, aber schon laenger offen.",
  });

  await browserPost(page, baseURL!, `/api/v1/seed-batches/${seedBatchB.id}/germination-tests`, {
    testedAt: "2026-01-20T00:00:00.000Z",
    sampleSize: 10,
    germinatedCount: 5,
    notes: "Nur noch als Backup fuehren.",
  });

  const profile = await browserPost<{ id: string }>(page, baseURL!, "/api/v1/profiles", {
    name: "Berlin Fruehjahr",
    lastFrostDate: "2026-04-10T00:00:00.000Z",
    firstFrostDate: "2026-10-15T00:00:00.000Z",
    notes: "Aktives Profil fuer Sprint-QA",
    isActive: true,
    phenologyStage: "first-spring",
    phenologyObservedAt: "2026-03-26T08:00:00.000Z",
  });

  await browserPost(page, baseURL!, "/api/v1/cultivation-rules", {
    varietyId: blackCherry.id,
    indoorSowingStartWeeks: 3,
    indoorSowingEndWeeks: 1,
    transplantStartWeeks: 1,
    transplantEndWeeks: 2,
    harvestStartDays: 70,
    harvestEndDays: 95,
    notes: "Langer Erntekorridor fuer Sichttest.",
  });

  await browserPost(page, baseURL!, "/api/v1/plantings", {
    varietyId: blackCherry.id,
    type: "SOW_INDOORS",
    growingProfileId: profile.id,
    seedBatchId: seedBatchA.id,
    quantityUsed: 12,
    actualDate: "2026-03-26T00:00:00.000Z",
    locationNote: "Gewaechshaus Tray A",
    notes: "Sprint-QA Pflanzung",
  });

  await page.setViewportSize({ width: 1100, height: 1400 });
  await page.goto("/");

  await page.getByRole("button", { name: "Katalog" }).click();
  await expect(page.getByRole("heading", { name: "Sorten und Chargen ordnen." })).toBeVisible();

  const tomatoSection = page.locator("section").filter({ hasText: "ARTEN" }).filter({ hasText: "Tomate" }).first();
  await expect(tomatoSection).toContainText("2 sorten");
  await expect(tomatoSection).toContainText("Black Cherry");
  await expect(tomatoSection).toContainText("Roma VF");

  const blackCherryCard = tomatoSection.locator("details").filter({ has: page.getByRole("heading", { name: "Black Cherry" }) }).first();
  await expect(blackCherryCard).toContainText("Sorte");
  await blackCherryCard.locator("summary").first().click();

  await expect(blackCherryCard).toContainText("Art");
  await expect(blackCherryCard).toContainText("Sorte");
  await expect(blackCherryCard).toContainText("Charge");
  await expect(blackCherryCard).toContainText("Katalogwerkzeuge");
  await expect(blackCherryCard).toContainText("Black Cherry");
  await expect(blackCherryCard).toContainText("Tomate");
  await expect(blackCherryCard).toContainText("2");

  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.locator("main")).toContainText("Mit dem Gartenjahr planen.");
  await expect(page.locator("main")).toContainText("Profile im Überblick");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.locator("main")).toContainText("Aussaatfenster festlegen.");
  await expect(page.locator("main")).toContainText("Regeln im Überblick");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Pflanzungen" }).click();
  await expect(page.locator("main")).toContainText("Arbeit im Beet festhalten.");
  await expect(page.locator("main")).toContainText("Letzte Einträge");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Arbeitsbereich & Konto" }).click();
  await expect(page.getByRole("heading", { name: "Arbeitsbereich gemeinsam verwalten." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dein Konto" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Passkeys hinzufügen" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
