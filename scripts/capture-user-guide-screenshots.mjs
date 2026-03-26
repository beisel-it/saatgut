import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

async function assertOk(response, label) {
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()} ${response.statusText()}`);
  }
}

const baseURL = process.env.USER_GUIDE_BASE_URL ?? "http://127.0.0.1:3006";
const outputDir = path.join(process.cwd(), "docs", "screenshots", "benutzerhandbuch");
const stamp = Date.now().toString();
const workspaceName = "Saatgut Demogarten";
const email = `doku-${stamp}@example.com`;
const password = "sicheres passwort 123";

fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1400 },
});
const page = await context.newPage();
const request = context.request;

try {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outputDir, "01-anmeldung.png"), fullPage: true });

  const authForm = page.locator("form").first();
  await authForm.getByLabel("E-Mail").fill(email);
  await authForm.getByLabel("Passwort").fill(password);
  await authForm.getByLabel("Name des Arbeitsbereichs").fill(workspaceName);
  await authForm.getByRole("button", { name: "Arbeitsbereich anlegen" }).click();
  await page.getByRole("heading", { name: workspaceName }).waitFor();

  const speciesResponse = await request.post(`${baseURL}/api/v1/species`, {
    data: {
      commonName: "Tomate",
      latinName: "Solanum lycopersicum",
      category: "VEGETABLE",
      notes: "Wärmeliebende Fruchtgemüse-Kultur für die Doku.",
    },
  });
  await assertOk(speciesResponse, "create species");
  const species = await speciesResponse.json();

  const varietyResponse = await request.post(`${baseURL}/api/v1/varieties`, {
    data: {
      speciesId: species.id,
      name: "Rote Murmel",
      description: "Kompakte Salattomate für Kübel und geschützte Lagen.",
      heirloom: true,
      tags: ["alte Sorte", "Gewächshaus"],
      notes: "Geeignet für frühe Aussaat im Haus.",
      synonyms: ["Red Cherry"],
    },
  });
  await assertOk(varietyResponse, "create variety");
  const variety = await varietyResponse.json();

  const batchResponse = await request.post(`${baseURL}/api/v1/seed-batches`, {
    data: {
      varietyId: variety.id,
      source: "Eigene Saatgutgewinnung",
      harvestYear: 2023,
      quantity: 120,
      unit: "SEEDS",
      storageLocation: "Kellerregal links",
      storageTemperatureC: 19,
      storageHumidityPercent: 72,
      storageLightExposure: "BRIGHT",
      storageMoistureLevel: "HUMID",
      storageContainer: "Schraubglas",
      storageQualityCheckedAt: "2026-03-25T10:00:00.000Z",
      notes: "Absichtlich mit kritischen Lagerwerten für die Doku.",
    },
  });
  await assertOk(batchResponse, "create seed batch");
  const batch = await batchResponse.json();

  const germinationResponse = await request.post(
    `${baseURL}/api/v1/seed-batches/${batch.id}/germination-tests`,
    {
      data: {
        testedAt: "2026-03-26T08:00:00.000Z",
        sampleSize: 10,
        germinatedCount: 7,
        notes: "Solide Keimung, aber etwas ungleichmäßig.",
      },
    },
  );
  await assertOk(germinationResponse, "create germination test");

  const adjustmentResponse = await request.post(
    `${baseURL}/api/v1/seed-batches/${batch.id}/transactions`,
    {
      data: {
        mode: "ADJUST_DELTA",
        quantity: 5,
        reason: "Nachzählung nach Umtüten",
        effectiveDate: "2026-03-26T09:00:00.000Z",
      },
    },
  );
  await assertOk(adjustmentResponse, "create stock adjustment");

  const profileResponse = await request.post(`${baseURL}/api/v1/profiles`, {
    data: {
      name: "Berlin-Mitte Frühling",
      lastFrostDate: "2026-04-10T00:00:00.000Z",
      firstFrostDate: "2026-10-18T00:00:00.000Z",
      notes: "Städtischer Innenhof mit windgeschützter Südwand.",
      isActive: true,
      phenologyStage: "first-spring",
      phenologyObservedAt: "2026-03-26T07:00:00.000Z",
      phenologyNotes: "Forsythie beginnt gerade zu blühen.",
    },
  });
  await assertOk(profileResponse, "create profile");
  const profile = await profileResponse.json();

  const ruleResponse = await request.post(`${baseURL}/api/v1/cultivation-rules`, {
    data: {
      varietyId: variety.id,
      sowIndoorsStartWeeks: 8,
      sowIndoorsEndWeeks: 4,
      transplantStartWeeks: 1,
      transplantEndWeeks: 2,
      harvestStartDays: 75,
      harvestEndDays: 95,
      spacingCm: 45,
      successionIntervalDays: 14,
    },
  });
  await assertOk(ruleResponse, "create cultivation rule");

  const plantingResponse = await request.post(`${baseURL}/api/v1/plantings`, {
    data: {
      varietyId: variety.id,
      seedBatchId: batch.id,
      growingProfileId: profile.id,
      type: "SOW_INDOORS",
      actualDate: "2026-03-26T11:00:00.000Z",
      quantityUsed: 12,
      locationNote: "Fensterbank Südseite",
      notes: "Aussaat in Quickpot-Platte.",
    },
  });
  await assertOk(plantingResponse, "create planting event");

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Arbeitsbereich aktualisieren" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outputDir, "02-uebersicht.png"), fullPage: true });

  await page.getByRole("button", { name: "Katalog" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outputDir, "03-katalog.png"), fullPage: true });

  await page.getByRole("button", { name: "Profile" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outputDir, "04-profile.png"), fullPage: true });

  await page.getByRole("button", { name: "Regeln" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outputDir, "05-regeln.png"), fullPage: true });

  await page.getByRole("button", { name: "Pflanzungen" }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: path.join(outputDir, "06-pflanzungen.png"), fullPage: true });
} finally {
  await browser.close();
}
