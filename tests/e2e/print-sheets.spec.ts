import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const workspaceName = `Drucksatz Garten ${suffix}`;
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `print-${suffix}@example.com`,
      password: "correct horse battery staple",
      workspaceName,
    },
  });

  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  return workspaceName;
}

async function browserPost<T>(page: Page, path: string, data: unknown) {
  const response = await page.evaluate(
    async ({ path, data }) => {
      const result = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      return {
        status: result.status,
        payload: await result.json().catch(() => null),
      };
    },
    { path, data },
  );

  expect(response.status, `${path} should succeed`).toBeGreaterThanOrEqual(200);
  expect(response.status, `${path} should succeed`).toBeLessThan(300);

  return response.payload as T;
}

test("German A4 print sheets keep content complete and print-friendly", async ({ page, baseURL, browserName }) => {
  test.skip(browserName !== "chromium", "PDF export assertions require Chromium.");

  const stamp = Date.now().toString();
  await registerWorkspace(page, baseURL!, stamp);
  const profile = await browserPost<{ id: string }>(page, "/api/v1/profiles", {
    name: `Berlin ${stamp}`,
    lastFrostDate: "2026-04-10T00:00:00.000Z",
    firstFrostDate: "2026-10-15T00:00:00.000Z",
    notes: "Aktives Profil für den Drucktest",
    isActive: true,
    phenologyStage: "first-spring",
    phenologyObservedAt: "2026-03-26T08:00:00.000Z",
  });

  for (let varietyIndex = 1; varietyIndex <= 3; varietyIndex += 1) {
    const species = await browserPost<{ id: string }>(page, "/api/v1/species", {
      commonName: `Tomate ${stamp}-${varietyIndex}`,
      latinName: "Solanum lycopersicum",
      category: "VEGETABLE",
      notes: "Art für den Drucktest",
    });

    const variety = await browserPost<{ id: string }>(page, "/api/v1/varieties", {
      speciesId: species.id,
      name: `Sorte ${stamp}-${varietyIndex}`,
      description: "Sortenblatt für A4-Drucktest",
      heirloom: varietyIndex % 2 === 1,
      tags: ["druck", `satz-${varietyIndex}`],
      notes: `Sortennotiz ${varietyIndex}`,
      synonyms: [`Alias ${varietyIndex}`],
    });

    await browserPost(page, "/api/v1/cultivation-rules", {
      varietyId: variety.id,
      sowIndoorsStartWeeks: 8,
      sowIndoorsEndWeeks: 4,
      transplantStartWeeks: 1,
      transplantEndWeeks: 2,
      harvestStartDays: 70,
      harvestEndDays: 90,
    });

    for (let batchIndex = 1; batchIndex <= 2; batchIndex += 1) {
      const seedBatch = await browserPost<{ id: string }>(page, "/api/v1/seed-batches", {
        varietyId: variety.id,
        source: `Quelle ${varietyIndex}-${batchIndex}`,
        harvestYear: 2024,
        quantity: 40 + varietyIndex * 10 + batchIndex,
        unit: "SEEDS",
        storageLocation: batchIndex === 1 ? `Regal ${varietyIndex}` : `Kiste ${varietyIndex}`,
        storageTemperatureC: batchIndex === 1 ? 18 : 9,
        storageHumidityPercent: batchIndex === 1 ? 70 : 34,
        storageLightExposure: batchIndex === 1 ? "BRIGHT" : "DARK",
        storageMoistureLevel: batchIndex === 1 ? "HUMID" : "DRY",
        storageContainer: batchIndex === 1 ? "Schraubglas" : "Papierbeutel",
        storageQualityCheckedAt: "2026-03-26T09:00:00.000Z",
        notes: `Chargennotiz ${varietyIndex}-${batchIndex}`,
      });

      await browserPost(page, `/api/v1/seed-batches/${seedBatch.id}/germination-tests`, {
        testedAt: "2026-03-26T10:00:00.000Z",
        sampleSize: 10,
        germinatedCount: batchIndex === 1 ? 6 : 9,
        notes: `Keimtest ${varietyIndex}-${batchIndex}`,
      });

      if (batchIndex === 1) {
        await browserPost(page, "/api/v1/plantings", {
          varietyId: variety.id,
          seedBatchId: seedBatch.id,
          growingProfileId: profile.id,
          type: "SOW_INDOORS",
          actualDate: "2026-03-26T12:00:00.000Z",
          quantityUsed: 8,
          locationNote: `Anzucht ${varietyIndex}`,
        });
      }
    }
  }

  await page.goto("/");
  await page.getByRole("button", { name: "Druckbögen" }).click();

  await expect(page.getByRole("heading", { name: "A4-Druckbögen für Dein Saatgut." })).toBeVisible();
  await expect(page.getByText("Drucksatz zusammenstellen")).toBeVisible();
  await expect(page.getByText("Saatgut-Übersicht")).toBeVisible();
  await expect(page.getByText("Sortenblatt").first()).toBeVisible();
  await expect(page.getByText("Chargenkarte").first()).toBeVisible();

  const printPages = page.locator(".print-page");
  await expect(printPages).toHaveCount(5);

  const printPageMetrics = await printPages.first().evaluate((node) => {
    const element = node as HTMLElement;
    const styles = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      breakAfter: styles.breakAfter,
      width: rect.width,
      borderTopStyle: styles.borderTopStyle,
    };
  });
  expect(printPageMetrics.breakAfter).toBe("auto");
  expect(printPageMetrics.width).toBeGreaterThan(780);
  expect(printPageMetrics.width).toBeLessThan(810);
  expect(printPageMetrics.borderTopStyle).toBe("solid");

  const printCss = await page.evaluate(() => {
    const rules: string[] = [];
    for (const styleSheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(styleSheet.cssRules)) {
          rules.push(rule.cssText);
        }
      } catch {
        // ignore stylesheets the browser refuses to expose
      }
    }
    return rules.join("\n");
  });
  const normalizedPrintCss = printCss.toLowerCase();
  expect(normalizedPrintCss).toContain("@page");
  expect(normalizedPrintCss).toContain("size: a4 portrait");
  expect(normalizedPrintCss).toContain("break-after: page");

  await page.evaluate(() => {
    (window as typeof window & { __printCalls?: number }).__printCalls = 0;
    window.print = () => {
      (window as typeof window & { __printCalls?: number }).__printCalls =
        ((window as typeof window & { __printCalls?: number }).__printCalls ?? 0) + 1;
    };
  });
  await page.getByRole("button", { name: "Drucken oder als PDF sichern" }).click();
  expect(
    await page.evaluate(() => (window as typeof window & { __printCalls?: number }).__printCalls ?? 0),
  ).toBe(1);

  await page.emulateMedia({ media: "print" });
  const printState = await page.evaluate(() => {
    const hiddenHeader = document.querySelector<HTMLElement>(".print-hide");
    const pageElement = document.querySelector<HTMLElement>(".print-page");
    const sheetCard = document.querySelector<HTMLElement>(".sheet-card");
    return {
      hiddenDisplay: hiddenHeader ? getComputedStyle(hiddenHeader).display : null,
      pageBreakAfter: pageElement ? getComputedStyle(pageElement).breakAfter : null,
      sheetCardBreakInside: sheetCard ? getComputedStyle(sheetCard).breakInside : null,
    };
  });
  expect(printState.hiddenDisplay).toBe("none");
  expect(printState.pageBreakAfter).toBe("page");
  expect(printState.sheetCardBreakInside).toBe("avoid");

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.byteLength).toBeGreaterThan(20_000);

  await page.emulateMedia({ media: "screen" });

  await page.getByLabel("Inhalt").selectOption("DIGEST");
  await expect(printPages).toHaveCount(1);
  await expect(page.getByText("Saatgut-Übersicht")).toBeVisible();
  await expect(page.getByText("Sortenblatt")).toHaveCount(0);

  await page.getByLabel("Inhalt").selectOption("VARIETIES");
  await expect(printPages).toHaveCount(2);
  await expect(page.getByText("Sortenblatt").first()).toBeVisible();
  await expect(page.getByText("Saatgut-Übersicht")).toHaveCount(0);

  await page.getByLabel("Inhalt").selectOption("BATCHES");
  await expect(printPages).toHaveCount(2);
  await expect(page.getByText("Chargenkarte").first()).toBeVisible();
  await expect(page.getByText("Sortenblatt")).toHaveCount(0);

  await page.getByLabel("Inhalt").selectOption("ALL");
  await expect(printPages).toHaveCount(5);

  await page.getByLabel("Notizen und Lagerdetails mitdrucken").uncheck();
  await expect(page.locator(".print-root")).not.toContainText("Chargennotiz 1-1");
  await expect(page.locator(".print-root")).not.toContainText("Sortennotiz 1");

  await page.getByLabel("Nur Einträge mit Bestand").uncheck();
  await expect(page.getByText("Sorten im Satz").first()).toBeVisible();
});
