import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type SpeciesRecord = {
  id: string;
  commonName: string;
  category: string;
};

type VarietyRecord = {
  id: string;
  name: string;
  speciesId: string;
};

type SeedBatchRecord = {
  id: string;
  varietyId: string;
  quantity: number | string;
  source: string | null;
  unit: string;
  storageLocation: string | null;
};

async function registerWorkspace(page: Page, suffix: string) {
  await page.goto("/");

  const workspaceName = `Katalog Intake ${suffix}`;
  const authForm = page.locator("form").first();
  await authForm.getByLabel("E-Mail").fill(`catalog-${suffix}@example.com`);
  await authForm.getByLabel("Passwort").fill("correct horse battery staple");
  await authForm.getByLabel("Name des Arbeitsbereichs").fill(workspaceName);
  await authForm.getByRole("button", { name: "Arbeitsbereich anlegen", exact: true }).click();

  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}

async function browserJson<T>(page: Page, path: string) {
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

  return response.payload as T;
}

async function browserCollection<T>(page: Page, path: string) {
  const response = await browserJson<{ items: T[] }>(page, path);
  return response.items;
}

test("guided packet intake creates linked catalog records and leaves manual catalog workflows intact", async ({
  page,
}) => {
  const stamp = Date.now().toString();
  const guidedSpeciesName = "Tomate";
  const guidedVarietyName = `Rote Murmel ${stamp}`;
  const guidedPacketLabel = `${guidedVarietyName} ${guidedSpeciesName}`;
  const guidedSourceA = `Saatgutarchiv ${stamp}`;
  const guidedSourceB = `Tauschkiste ${stamp}`;
  const manualSpeciesName = `Basilikum ${stamp}`;
  const manualVarietyName = `Genovese ${stamp}`;
  const manualBatchSource = `Gaertnerei ${stamp}`;

  await registerWorkspace(page, stamp);
  await page.getByRole("button", { name: "Katalog" }).click();

  await expect(page.getByRole("heading", { name: "Neue Saatgutpackung erfassen" })).toBeVisible();
  const intakeForm = page.locator("form").filter({ has: page.getByLabel("Name auf der Packung") }).first();
  const inventoryPanel = page
    .getByRole("heading", { name: "Sorten und Vorrat" })
    .locator("xpath=ancestor::section[1]");

  await intakeForm.getByLabel("Name auf der Packung").fill(guidedPacketLabel);
  await intakeForm.getByLabel("Menge").fill("3");
  await intakeForm.getByLabel("Einheit").selectOption("PACKETS");
  await intakeForm.getByLabel("Quelle").fill(guidedSourceA);
  await intakeForm.getByLabel("Erntejahr").fill("2025");
  await intakeForm.getByLabel("Lagerort").fill("Regal A");
  await intakeForm.getByLabel("Notizen").fill("Erster Intake-Lauf");
  await intakeForm.getByRole("button", { name: "Charge speichern", exact: true }).click();

  await expect(page.getByText("Saatgutpackung erfasst.")).toBeVisible();
  await expect(inventoryPanel).toContainText(guidedVarietyName);
  await expect(inventoryPanel).toContainText("Regal A");

  let species = await browserCollection<SpeciesRecord>(page, "/api/v1/species");
  let varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  let seedBatches = await browserCollection<SeedBatchRecord>(page, "/api/v1/seed-batches");

  expect(species).toHaveLength(1);
  expect(species[0].commonName).toBe(guidedSpeciesName);
  expect(varieties).toHaveLength(1);
  expect(varieties[0].name).toBe(guidedVarietyName);
  expect(varieties[0].speciesId).toBe(species[0].id);
  expect(seedBatches).toHaveLength(1);
  expect(seedBatches[0].varietyId).toBe(varieties[0].id);
  expect(seedBatches[0].source).toBe(guidedSourceA);
  expect(Number(seedBatches[0].quantity)).toBe(3);
  expect(seedBatches[0].unit).toBe("PACKETS");

  await intakeForm.getByLabel("Name auf der Packung").fill(guidedPacketLabel);
  await intakeForm.getByLabel("Menge").fill("2");
  await intakeForm.getByLabel("Einheit").selectOption("PACKETS");
  await intakeForm.getByLabel("Quelle").fill(guidedSourceB);
  await intakeForm.getByLabel("Erntejahr").fill("2024");
  await intakeForm.getByLabel("Lagerort").fill("Regal B");
  await intakeForm.getByLabel("Notizen").fill("Zweiter Intake-Lauf");
  await intakeForm.getByRole("button", { name: "Charge speichern", exact: true }).click();

  await expect(page.getByText("Saatgutpackung erfasst.")).toBeVisible();
  await expect(inventoryPanel).toContainText("Regal B");

  species = await browserCollection<SpeciesRecord>(page, "/api/v1/species");
  varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  seedBatches = await browserCollection<SeedBatchRecord>(page, "/api/v1/seed-batches");

  expect(species).toHaveLength(1);
  expect(varieties).toHaveLength(1);
  expect(seedBatches).toHaveLength(2);
  expect(new Set(seedBatches.map((seedBatch) => seedBatch.varietyId))).toEqual(new Set([varieties[0].id]));
  expect(new Set(seedBatches.map((seedBatch) => seedBatch.source))).toEqual(new Set([guidedSourceA, guidedSourceB]));

  await page.locator("summary").filter({ hasText: "Erweiterte Pflege" }).click();
  await page.locator("summary").filter({ hasText: "Arten anlegen" }).click();

  const speciesTool = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Arten anlegen" }) }).last();
  const speciesForm = speciesTool.locator("form").first();
  await speciesForm.getByLabel("Allgemeiner Name").fill(manualSpeciesName);
  await speciesForm.getByLabel("Kategorie").selectOption("HERB");
  await speciesForm.getByLabel("Notizen").fill("Manuell gepflegte Kraeuterart");
  await speciesForm.getByRole("button", { name: "Art speichern", exact: true }).click();

  await expect(page.getByText("Art gespeichert.")).toBeVisible();

  await page.locator("summary").filter({ hasText: "Sorten anlegen" }).click();

  const varietyTool = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Sorten anlegen" }) }).last();
  const varietyForm = varietyTool.locator("form").first();
  await varietyForm.getByLabel("Art").selectOption({ label: manualSpeciesName });
  await varietyForm.getByLabel("Sortenname").fill(manualVarietyName);
  await varietyForm.getByLabel("Synonyme").fill("Italienisches Basilikum");
  await varietyForm.getByLabel("Tags").fill("kueche, pesto");
  await varietyForm.getByLabel("Beschreibung").fill("Manuell angelegte Vergleichssorte");
  await varietyForm.getByRole("button", { name: "Sorte speichern", exact: true }).click();

  await expect(page.getByText("Sorte gespeichert.")).toBeVisible();

  await page.locator("summary").filter({ hasText: "Chargen pflegen" }).click();

  const batchTool = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: "Chargen pflegen" }) }).last();
  const batchForm = batchTool.locator("form").first();
  await batchForm.getByLabel("Sorte").selectOption({ label: manualVarietyName });
  await batchForm.getByLabel("Menge").fill("12");
  await batchForm.getByLabel("Einheit").selectOption("SEEDS");
  await batchForm.getByLabel("Erntejahr").fill("2026");
  await batchForm.getByLabel("Quelle").fill(manualBatchSource);
  await batchForm.getByLabel("Lagerort").fill("Kraeuterregal");
  await batchForm.getByRole("button", { name: "Charge speichern", exact: true }).click();

  await expect(page.getByText("Charge gespeichert.")).toBeVisible();
  await expect(inventoryPanel).toContainText(manualVarietyName);
  await expect(inventoryPanel).toContainText("Kraeuterregal");

  species = await browserCollection<SpeciesRecord>(page, "/api/v1/species");
  varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  seedBatches = await browserCollection<SeedBatchRecord>(page, "/api/v1/seed-batches");

  expect(species).toHaveLength(2);
  const manualSpecies = species.find((entry) => entry.commonName === manualSpeciesName);
  expect(manualSpecies).toBeTruthy();
  expect(manualSpecies?.category).toBe("HERB");

  expect(varieties).toHaveLength(2);
  const manualVariety = varieties.find((entry) => entry.name === manualVarietyName);
  expect(manualVariety).toBeTruthy();
  expect(manualVariety?.speciesId).toBe(manualSpecies?.id);

  expect(seedBatches).toHaveLength(3);
  const manualSeedBatch = seedBatches.find((entry) => entry.source === manualBatchSource);
  expect(manualSeedBatch).toBeTruthy();
  expect(manualSeedBatch?.varietyId).toBe(manualVariety?.id);
  expect(Number(manualSeedBatch?.quantity)).toBe(12);
  expect(manualSeedBatch?.storageLocation).toBe("Kraeuterregal");

  await page.getByLabel("Im Katalog suchen").fill(manualVarietyName);
  await expect(inventoryPanel).toContainText(manualVarietyName);
  await expect(inventoryPanel).toContainText("Kraeuterregal");
  await expect(inventoryPanel).not.toContainText(guidedVarietyName);

  await page.getByLabel("Im Katalog suchen").fill("");
  await page.getByLabel("Artengruppe").selectOption("HERB");
  await page.getByLabel("Ansicht").selectOption("ON_HAND");
  await expect(inventoryPanel).toContainText(manualSpeciesName);
  await expect(inventoryPanel).toContainText(manualVarietyName);
  await expect(inventoryPanel).toContainText("Kraeuterregal");
  await expect(inventoryPanel).not.toContainText(guidedVarietyName);
});
