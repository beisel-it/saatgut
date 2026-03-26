import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type SpeciesRecord = {
  id: string;
  commonName: string;
  germinationNotes: string | null;
  preferredLocation: string | null;
  companionPlantingNotes: string | null;
};

type VarietyRecord = {
  id: string;
  name: string;
  speciesId: string;
  germinationNotes: string | null;
  preferredLocation: string | null;
  companionPlantingNotes: string | null;
};

type CalendarItem = {
  kind: string;
  type: string;
  varietyName: string;
};

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const workspaceName = `QA Kulturhinweise ${suffix}`;
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `qa-guidance-${suffix}@example.com`,
      password: "correct horse battery staple",
      workspaceName,
    },
  });

  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}

async function browserPost<T>(page: Page, path: string, data: unknown) {
  const response = await page.evaluate(
    async ({ requestPath, payload }) => {
      const result = await fetch(requestPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      return {
        status: result.status,
        payload: await result.json().catch(() => null),
      };
    },
    { requestPath: path, payload: data },
  );

  expect(response.status, `${path} should succeed`).toBeGreaterThanOrEqual(200);
  expect(response.status, `${path} should succeed`).toBeLessThan(300);

  return response.payload as T;
}

async function browserCollection<T>(page: Page, path: string) {
  const response = await page.evaluate(async (requestPath) => {
    const result = await fetch(requestPath, {
      headers: {
        Accept: "application/json",
      },
    });

    return {
      status: result.status,
      payload: await result.json().catch(() => null),
    };
  }, path);

  expect(response.status, `${path} should succeed`).toBeGreaterThanOrEqual(200);
  expect(response.status, `${path} should succeed`).toBeLessThan(300);

  return (response.payload as { items: T[] }).items;
}

function browseCard(inventoryPanel: Locator, varietyName: string) {
  return inventoryPanel
    .getByRole("heading", { name: varietyName, exact: true, level: 3 })
    .locator("xpath=ancestor::details[1]");
}

test("horticultural guidance supports species defaults, variety overrides, and calendar regressions", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  const speciesName = `Paprika ${stamp}`;
  const fallbackVarietyName = `Fruehe Spitzpaprika ${stamp}`;
  const overrideVarietyName = `Rote Blockpaprika ${stamp}`;
  const speciesGermination = "Warm anziehen und gleichmaessig feucht halten.";
  const speciesLocation = "Sonniges Beet mit Windschutz.";
  const speciesCompanion = "Gut neben Zwiebeln und Salat.";
  const overrideGermination = "Samen vorquellen und konstant bei 24 Grad halten.";
  const overrideLocation = "Gewaechshausplatz an der Suedseite.";
  const overrideCompanion = "Passt besonders gut zu Moehren.";

  await registerWorkspace(page, baseURL!, stamp);
  await page.getByRole("button", { name: "Katalog" }).click();
  await page.getByRole("button", { name: "Werkzeuge zeigen" }).click();
  await page.locator("summary").filter({ hasText: "Erweiterte Pflege" }).click();
  await page.locator("summary").filter({ hasText: "Arten anlegen" }).click();

  const speciesTool = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: "Arten anlegen" }) })
    .last();
  const speciesForm = speciesTool.locator("form").first();

  await speciesForm.getByLabel("Allgemeiner Name").fill(speciesName);
  await speciesForm.getByLabel("Kategorie").selectOption("VEGETABLE");
  await speciesForm.getByLabel("Keimbedingungen").fill(speciesGermination);
  await speciesForm.getByLabel("Bevorzugter Standort").fill(speciesLocation);
  await speciesForm.getByLabel("Mischkultur-Hinweise").fill(speciesCompanion);
  await speciesForm.getByRole("button", { name: "Art speichern", exact: true }).click();
  await expect(page.getByText("Art gespeichert.")).toBeVisible();

  await page.locator("summary").filter({ hasText: "Sorten anlegen" }).click();
  const varietyTool = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: "Sorten anlegen" }) })
    .last();
  const createForm = varietyTool.locator("form").first();

  await createForm.getByLabel("Art").selectOption({ label: speciesName });
  await createForm.getByLabel("Sortenname").fill(fallbackVarietyName);
  await createForm.getByRole("button", { name: "Sorte speichern", exact: true }).click();
  await expect(page.getByText("Sorte gespeichert.")).toBeVisible();

  await createForm.getByLabel("Art").selectOption({ label: speciesName });
  await createForm.getByLabel("Sortenname").fill(overrideVarietyName);
  await createForm.getByLabel("Keimbedingungen").fill(overrideGermination);
  await createForm.getByLabel("Bevorzugter Standort").fill(overrideLocation);
  await createForm.getByLabel("Mischkultur-Hinweise").fill(overrideCompanion);
  await createForm.getByRole("button", { name: "Sorte speichern", exact: true }).click();
  await expect(page.getByText("Sorte gespeichert.")).toBeVisible();

  const species = await browserCollection<SpeciesRecord>(page, "/api/v1/species");
  const storedSpecies = species.find((entry) => entry.commonName === speciesName);
  expect(storedSpecies).toBeTruthy();
  expect(storedSpecies?.germinationNotes).toBe(speciesGermination);
  expect(storedSpecies?.preferredLocation).toBe(speciesLocation);
  expect(storedSpecies?.companionPlantingNotes).toBe(speciesCompanion);

  const varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  const fallbackVariety = varieties.find((entry) => entry.name === fallbackVarietyName);
  const overrideVariety = varieties.find((entry) => entry.name === overrideVarietyName);
  expect(fallbackVariety).toBeTruthy();
  expect(fallbackVariety?.germinationNotes).toBeNull();
  expect(fallbackVariety?.preferredLocation).toBeNull();
  expect(fallbackVariety?.companionPlantingNotes).toBeNull();
  expect(overrideVariety).toBeTruthy();
  expect(overrideVariety?.germinationNotes).toBe(overrideGermination);
  expect(overrideVariety?.preferredLocation).toBe(overrideLocation);
  expect(overrideVariety?.companionPlantingNotes).toBe(overrideCompanion);

  const inventoryPanel = page.getByRole("heading", { name: "Sorten und Vorrat" }).locator("xpath=ancestor::section[1]");
  const fallbackCard = browseCard(inventoryPanel, fallbackVarietyName);
  await fallbackCard.locator("summary").click();
  await expect(fallbackCard).toContainText("Kulturhinweise");
  await expect(fallbackCard).toContainText(speciesGermination);
  await expect(fallbackCard).toContainText(speciesLocation);
  await expect(fallbackCard).toContainText(speciesCompanion);
  await fallbackCard.locator("summary").click();

  const overrideCard = browseCard(inventoryPanel, overrideVarietyName);
  await overrideCard.locator("summary").click();
  await expect(overrideCard).toContainText("Kulturhinweise");
  await expect(overrideCard).toContainText(overrideGermination);
  await expect(overrideCard).toContainText(overrideLocation);
  await expect(overrideCard).toContainText(overrideCompanion);
  await expect(overrideCard).not.toContainText(speciesGermination);

  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Aussaatfenster festlegen." })).toBeVisible();
  const rulesMain = page.locator("main");

  await page.getByLabel("Sorte").selectOption({ label: fallbackVarietyName });
  await expect(rulesMain).toContainText(speciesGermination);
  await expect(rulesMain).toContainText(speciesLocation);
  await expect(rulesMain).toContainText(speciesCompanion);

  await page.getByLabel("Sorte").selectOption({ label: overrideVarietyName });
  await expect(rulesMain).toContainText(overrideGermination);
  await expect(rulesMain).toContainText(overrideLocation);
  await expect(rulesMain).toContainText(overrideCompanion);

  await page.getByLabel("Frühester Zeitpunkt (Wochen davor)").first().fill("3");
  await page.getByLabel("Spätester Zeitpunkt (Wochen davor)").first().fill("1");
  await page.getByLabel("Frühester Zeitpunkt (Wochen danach)").first().fill("1");
  await page.getByLabel("Spätester Zeitpunkt (Wochen danach)").first().fill("2");
  await page.getByLabel("Frühester Zeitpunkt (Tage danach)").fill("70");
  await page.getByLabel("Spätester Zeitpunkt (Tage danach)").fill("95");
  await page.getByRole("button", { name: "Regel speichern" }).click();

  await expect
    .poll(async () => {
      const rules = await browserCollection<{ variety: { name: string } }>(page, "/api/v1/cultivation-rules");
      return rules.map((rule) => rule.variety.name);
    })
    .toContain(overrideVarietyName);

  await browserPost(page, "/api/v1/profiles", {
    name: `Berlin ${stamp}`,
    lastFrostDate: "2026-04-10T00:00:00.000Z",
    firstFrostDate: "2026-10-15T00:00:00.000Z",
    notes: "Aktives Profil fuer Kulturhinweis-QA",
    isActive: true,
    phenologyStage: "first-spring",
    phenologyObservedAt: "2026-03-26T08:00:00.000Z",
  });

  const calendarItems = await browserCollection<CalendarItem>(
    page,
    "/api/v1/calendar?days=14&from=2026-03-26T00:00:00.000Z",
  );
  expect(calendarItems.some((item) => item.varietyName === overrideVarietyName)).toBe(true);

  await page.getByRole("button", { name: "Übersicht" }).click();
  await page.reload();
  await expect(page.locator("main")).toContainText(overrideVarietyName);
  await expect(page.locator("main")).toContainText("14 Tage");
});
