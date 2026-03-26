import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const workspaceName = `P1 Shell ${suffix}`;
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `p1-shell-${suffix}@example.com`,
      password: "correct horse battery staple",
      workspaceName,
    },
  });

  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}

test("dashboard hero stays on overview while other sections use their own headers", async ({ page, baseURL }) => {
  const stamp = Date.now().toString();
  await registerWorkspace(page, baseURL!, stamp);

  await expect(page.getByText("HEUTE IM GARTEN")).toBeVisible();
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toBeVisible();

  await page.getByRole("button", { name: "Katalog" }).click();
  await expect(page.getByRole("heading", { name: "Sorten und Chargen pflegen." })).toBeVisible();
  await expect(page.getByText("HEUTE IM GARTEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toHaveCount(0);

  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: "Mit dem Gartenjahr planen." })).toBeVisible();
  await expect(page.getByText("HEUTE IM GARTEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toHaveCount(0);

  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Aussaatfenster festlegen." })).toBeVisible();
  await expect(page.getByText("HEUTE IM GARTEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toHaveCount(0);

  await page.getByRole("button", { name: "Druckbögen" }).click();
  await expect(page.getByRole("heading", { name: "A4-Druckbögen für Dein Saatgut." })).toBeVisible();
  await expect(page.getByText("HEUTE IM GARTEN")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Arbeitsbereich aktualisieren" })).toHaveCount(0);
});

test.describe("print sheets viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the print preview inside a narrow mobile viewport", async ({ page, baseURL }) => {
    const stamp = `${Date.now()}-mobile`;
    await registerWorkspace(page, baseURL!, stamp);

    await page.getByRole("button", { name: "Navigation öffnen" }).click();
    await page.getByRole("button", { name: "Druckbögen" }).click();

    await expect(page.getByRole("heading", { name: "A4-Druckbögen für Dein Saatgut." })).toBeVisible();
    await expect(page.getByText("Drucksatz zusammenstellen")).toBeVisible();
    await expect(page.getByText("Vorschau").first()).toBeVisible();

    const viewportMetrics = await page.evaluate(() => {
      const documentWidth = document.documentElement.scrollWidth;
      const root = document.querySelector<HTMLElement>(".print-root");
      const pageElement = document.querySelector<HTMLElement>(".print-page");

      return {
        viewportWidth: window.innerWidth,
        documentWidth,
        rootWidth: root?.getBoundingClientRect().width ?? 0,
        pageWidth: pageElement?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
    expect(viewportMetrics.rootWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
    expect(viewportMetrics.pageWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth + 1);
  });
});
