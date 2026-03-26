import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const translationMarkerPattern =
  /\b(?:translation missing|missing translation|todo|fixme|tbd|placeholder|translate me)\b|__[^_\s]+__|\[\[[^\]]+\]\]/i;

async function assertNoLeakedTranslationMarkers(page: Page) {
  const leaked = await page.evaluate((patternSource) => {
    const pattern = new RegExp(patternSource, "i");
    const textMatches = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((node) => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(node.tagName))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .filter((value) => pattern.test(value));

    const placeholderMatches = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]"),
    )
      .map((node) => node.getAttribute("placeholder")?.trim() ?? "")
      .filter(Boolean)
      .filter((value) => pattern.test(value));

    return [...new Set([...textMatches, ...placeholderMatches])];
  }, translationMarkerPattern.source);

  expect(leaked).toEqual([]);
}

async function registerWorkspace(page: Page, suffix: string) {
  await page.goto("/");

  await expect(page.getByText("Sprache")).toBeVisible();
  await expect(page.getByRole("button", { name: "Arbeitsbereich anlegen" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden" }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  const workspaceName = `Doku Garten ${suffix}`;
  const authForm = page.locator("form").first();
  await authForm.getByLabel("E-Mail").fill(`i18n-${suffix}@example.com`);
  await authForm.getByLabel("Passwort").fill("correct horse battery staple");
  await authForm.getByLabel("Name des Arbeitsbereichs").fill(workspaceName);
  await authForm.getByRole("button", { name: "Arbeitsbereich anlegen", exact: true }).click();

  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);

  return workspaceName;
}

test("default German UI does not leak untranslated strings across shipped flows", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  await registerWorkspace(page, stamp);

  const browserRequest = page.context().request;

  const speciesResponse = await browserRequest.post(`${baseURL}/api/v1/species`, {
    data: {
      commonName: `Tomate ${stamp}`,
      latinName: "Solanum lycopersicum",
      category: "VEGETABLE",
      notes: "German locale QA species",
    },
  });
  expect(speciesResponse.ok()).toBeTruthy();
  const species = await speciesResponse.json();

  const varietyResponse = await browserRequest.post(`${baseURL}/api/v1/varieties`, {
    data: {
      speciesId: species.id,
      name: `Roma ${stamp}`,
      description: "German locale QA variety",
      heirloom: true,
      tags: ["alte sorte", "qa"],
      notes: "Taggable variety",
      synonyms: ["Pflaumentomate"],
    },
  });
  expect(varietyResponse.ok()).toBeTruthy();
  const variety = await varietyResponse.json();

  const batchResponse = await browserRequest.post(`${baseURL}/api/v1/seed-batches`, {
    data: {
      varietyId: variety.id,
      source: "Saatgutarchiv",
      harvestYear: 2025,
      quantity: 80,
      unit: "SEEDS",
      storageLocation: "Kühles Regal",
      storageTemperatureC: 9,
      storageHumidityPercent: 35,
      storageLightExposure: "DARK",
      storageMoistureLevel: "DRY",
      storageContainer: "Papierbeutel",
      storageQualityCheckedAt: "2026-03-26T10:00:00.000Z",
      notes: "Stabile Lagerung",
    },
  });
  expect(batchResponse.ok()).toBeTruthy();
  const seedBatch = await batchResponse.json();

  const profileResponse = await browserRequest.post(`${baseURL}/api/v1/profiles`, {
    data: {
      name: `Berlin ${stamp}`,
      lastFrostDate: "2026-04-10T00:00:00.000Z",
      firstFrostDate: "2026-10-15T00:00:00.000Z",
      notes: "Aktives Testprofil",
      isActive: true,
    },
  });
  expect(profileResponse.ok()).toBeTruthy();
  const profile = await profileResponse.json();

  const ruleResponse = await browserRequest.post(`${baseURL}/api/v1/cultivation-rules`, {
    data: {
      varietyId: variety.id,
      sowIndoorsStartWeeks: 2,
      sowIndoorsEndWeeks: 0,
      harvestStartDays: 60,
      harvestEndDays: 80,
    },
  });
  expect(ruleResponse.ok()).toBeTruthy();

  const plantingResponse = await browserRequest.post(`${baseURL}/api/v1/plantings`, {
    data: {
      varietyId: variety.id,
      seedBatchId: seedBatch.id,
      growingProfileId: profile.id,
      type: "SOW_INDOORS",
      actualDate: "2026-03-26T12:00:00.000Z",
      quantityUsed: 12,
      locationNote: "Anzuchtplatte A",
    },
  });
  expect(plantingResponse.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toBeVisible();

  await expect(page.getByRole("button", { name: "Übersicht" })).toBeVisible();
  await expect(page.getByText("14-Tage-Kalender")).toBeVisible();
  await expect(page.getByText("Saatgutqualität im Blick")).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);

  await page.getByRole("button", { name: "Katalog" }).click();
  await expect(page.getByRole("heading", { name: "Arten", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sorten", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chargen", exact: true })).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);

  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Anbauprofile", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profilübersicht", exact: true })).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);

  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Anbauregeln", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aktuelle Regeln", exact: true })).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);

  await page.getByRole("button", { name: "Pflanzungen" }).click();
  await expect(page.getByRole("heading", { name: "Pflanzereignisse", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ereignisprotokoll", exact: true })).toBeVisible();
  await assertNoLeakedTranslationMarkers(page);
});
