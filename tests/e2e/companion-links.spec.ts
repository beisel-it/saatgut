import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type SpeciesRecord = {
  id: string;
  commonName: string;
};

type VarietyRecord = {
  id: string;
  name: string;
  speciesId: string;
  companionVarieties?: Array<{ id: string; name: string }>;
};

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const workspaceName = `QA Nachbarn ${suffix}`;
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `qa-companions-${suffix}@example.com`,
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

async function getCompanions(page: Page, varietyId: string) {
  return browserCollection<{ id: string; name: string }>(page, `/api/v1/varieties/${varietyId}/companions`);
}

async function expectCompanions(page: Page, varietyId: string, expectedNames: string[]) {
  await expect.poll(async () => {
    const companions = await getCompanions(page, varietyId);
    return companions.map((entry) => entry.name).sort();
  }).toEqual([...expectedNames].sort());
}

function existingVarietyCard(panel: Locator, varietyName: string) {
  return panel
    .getByRole("heading", { name: varietyName, exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
}

test("structured companion links work across create, edit, browse, filter, rules, and companion endpoints", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  const tomatoSpeciesName = `Tomate ${stamp}`;
  const herbSpeciesName = `Basilikum ${stamp}`;
  const flowerSpeciesName = `Ringelblume ${stamp}`;
  const basilVarietyName = `Genovese ${stamp}`;
  const marigoldVarietyName = `Orange Flash ${stamp}`;
  const targetVarietyName = `Rote Murmel ${stamp}`;

  await registerWorkspace(page, baseURL!, stamp);

  const tomatoSpecies = await browserPost<SpeciesRecord>(page, "/api/v1/species", {
    commonName: tomatoSpeciesName,
    latinName: "Solanum lycopersicum",
    category: "VEGETABLE",
    notes: "Art fuer Nachbarpflanzen-QA",
  });
  const herbSpecies = await browserPost<SpeciesRecord>(page, "/api/v1/species", {
    commonName: herbSpeciesName,
    latinName: "Ocimum basilicum",
    category: "HERB",
    notes: "Klassischer Mischkultur-Nachbar",
  });
  const flowerSpecies = await browserPost<SpeciesRecord>(page, "/api/v1/species", {
    commonName: flowerSpeciesName,
    latinName: "Calendula officinalis",
    category: "FLOWER",
    notes: "Blueten-Nachbar",
  });

  const basilVariety = await browserPost<VarietyRecord>(page, "/api/v1/varieties", {
    speciesId: herbSpecies.id,
    name: basilVarietyName,
    description: "Vorhandene Nachbarpflanze fuer Tomaten",
    heirloom: false,
    tags: ["mischkultur"],
    notes: "Vorab per API angelegt",
  });
  const marigoldVariety = await browserPost<VarietyRecord>(page, "/api/v1/varieties", {
    speciesId: flowerSpecies.id,
    name: marigoldVarietyName,
    description: "Zweite Nachbaroption fuer die Bearbeitung",
    heirloom: false,
    tags: ["begleiter"],
    notes: "Vorab per API angelegt",
  });

  await page.reload();
  await page.getByRole("button", { name: "Katalog" }).click();
  await page.getByRole("button", { name: "Werkzeuge zeigen" }).click();
  await page.locator("summary").filter({ hasText: "Erweiterte Pflege" }).click();
  await page.locator("summary").filter({ hasText: "Sorten anlegen" }).click();

  const varietyTool = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: "Sorten anlegen" }) })
    .last();
  const createForm = varietyTool.locator("form").first();

  await createForm.getByLabel("Art").selectOption({ label: tomatoSpeciesName });
  await createForm.getByLabel("Sortenname").fill(targetVarietyName);
  await createForm.getByLabel("Tags").fill("snack, test");
  await createForm.getByLabel("Mischkultur-Hinweise").fill("Vertraegt sich gut mit Basilikum.");
  await createForm.locator("select").nth(1).selectOption({ label: `${basilVarietyName} · ${herbSpeciesName}` });
  await createForm.getByRole("button", { name: "Nachbarpflanze hinzufügen" }).click();
  await expect(createForm).toContainText(`${basilVarietyName} · ${herbSpeciesName} · Entfernen`);
  await createForm.getByRole("button", { name: "Sorte speichern", exact: true }).click();

  await expect(page.getByText("Sorte gespeichert.")).toBeVisible();

  const varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  const targetVariety = varieties.find((entry) => entry.name === targetVarietyName);
  expect(targetVariety).toBeTruthy();
  expect(targetVariety?.speciesId).toBe(tomatoSpecies.id);

  await expectCompanions(page, targetVariety!.id, [basilVarietyName]);
  await expectCompanions(page, basilVariety.id, [targetVarietyName]);

  const existingCard = existingVarietyCard(varietyTool, targetVarietyName);
  await expect(existingCard).toContainText(`Gute Nachbarn: ${basilVarietyName}`);

  const inventoryPanel = page.getByRole("heading", { name: "Sorten und Vorrat" }).locator("xpath=ancestor::section[1]");
  await expect(inventoryPanel).toContainText(targetVarietyName);

  const browseCard = inventoryPanel
    .getByRole("heading", { name: targetVarietyName, exact: true, level: 3 })
    .locator("xpath=ancestor::details[1]");
  await browseCard.locator("summary").click();
  await expect(browseCard).toContainText("Strukturierte Nachbarpflanzen");
  await expect(browseCard).toContainText(basilVarietyName);
  await expect(browseCard).toContainText("Vertraegt sich gut mit Basilikum.");

  await page.getByLabel("Gute Nachbarn").selectOption({ label: `${basilVarietyName} · ${herbSpeciesName}` });
  await expect(inventoryPanel).toContainText(targetVarietyName);
  await expect(inventoryPanel).not.toContainText(marigoldVarietyName);

  await browseCard.locator("summary").click();

  await existingCard.getByRole("button", { name: "Bearbeiten" }).click();
  const editForm = varietyTool.locator("form").filter({ has: page.locator(`input[value="${targetVarietyName}"]`) }).first();
  const saveEditButton = editForm.getByRole("button", { name: "Änderungen speichern" }).first();
  await expect(saveEditButton).toBeVisible();
  await editForm.getByRole("button", { name: `${basilVarietyName} · ${herbSpeciesName} · Entfernen` }).click();
  await expect(editForm).toContainText("Noch keine strukturierten Nachbarpflanzen verknüpft.");
  await editForm.locator("select").nth(1).selectOption({ label: `${marigoldVarietyName} · ${flowerSpeciesName}` });
  await editForm.getByRole("button", { name: "Nachbarpflanze hinzufügen" }).click();
  await expect(editForm).toContainText(`${marigoldVarietyName} · ${flowerSpeciesName} · Entfernen`);
  await saveEditButton.click();

  await expectCompanions(page, targetVariety!.id, [marigoldVarietyName]);
  await expectCompanions(page, basilVariety.id, []);
  await expectCompanions(page, marigoldVariety.id, [targetVarietyName]);

  await expect(existingVarietyCard(varietyTool, targetVarietyName)).toContainText(`Gute Nachbarn: ${marigoldVarietyName}`);

  await page.getByLabel("Gute Nachbarn").selectOption({ label: `${basilVarietyName} · ${herbSpeciesName}` });
  await expect(inventoryPanel).not.toContainText(targetVarietyName);

  await page.getByLabel("Gute Nachbarn").selectOption({ label: `${marigoldVarietyName} · ${flowerSpeciesName}` });
  await expect(inventoryPanel).toContainText(targetVarietyName);

  await browseCard.locator("summary").click();
  await expect(browseCard).toContainText("Strukturierte Nachbarpflanzen");
  await expect(browseCard).toContainText(marigoldVarietyName);
  await expect(browseCard).not.toContainText(`Genovese ${stamp}`);

  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Aussaatfenster festlegen." })).toBeVisible();
  await page.getByLabel("Sorte").selectOption({ label: targetVarietyName });
  await expect(page.locator("main")).toContainText(targetVarietyName);
  await expect(page.locator("main")).toContainText("Strukturierte Nachbarpflanzen");
  await expect(page.locator("main")).toContainText(marigoldVarietyName);
});
