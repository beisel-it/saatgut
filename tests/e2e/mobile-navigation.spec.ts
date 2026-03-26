import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("refined mobile navigation opens, closes, and reaches every shipped surface", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  const workspaceName = `Mobil Garten ${stamp}`;

  await page.goto("/");

  const authForm = page.locator("form").first();
  await authForm.getByLabel("E-Mail").fill(`mobile-${stamp}@example.com`);
  await authForm.getByLabel("Passwort").fill("correct horse battery staple");
  await authForm.getByLabel("Name des Arbeitsbereichs").fill(workspaceName);
  await authForm.getByRole("button", { name: "Arbeitsbereich anlegen", exact: true }).click();

  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  let menuButton = page.getByRole("button", { name: "Navigation öffnen" });
  await menuButton.click();
  await page.getByRole("button", { name: "Profile" }).click();

  const profileForm = page.locator("form").first();
  await profileForm.getByLabel("Profilname").fill(`Berlin Mobil ${stamp}`);
  await profileForm.getByLabel("Datum letzter Frost").fill("2026-04-10");
  await profileForm.getByLabel("Datum erster Frost").fill("2026-10-15");
  await profileForm.getByLabel("Als aktives Planungsprofil markieren").check();
  await profileForm.getByLabel("Notizen").fill("Aktives Profil fuer mobile Navigation");
  await profileForm.getByRole("button", { name: "Profil speichern" }).click();

  await expect(page.getByText("Anbauprofil gespeichert.")).toBeVisible();

  await page.goto("/");

  menuButton = page.getByRole("button", { name: "Navigation öffnen" });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toHaveAttribute("aria-label", "Navigation öffnen");

  await menuButton.click();
  menuButton = page.getByRole("button", { name: "Navigation schließen" });
  const mobileNavigation = page.locator("section > div").filter({ has: menuButton }).first();
  await expect(menuButton).toHaveText("Navigation schließen");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(menuButton).toHaveAttribute("aria-label", "Navigation schließen");

  await expect(mobileNavigation.getByRole("button", { name: "Übersicht" })).toBeVisible();
  await expect(mobileNavigation.getByRole("button", { name: "Katalog" })).toBeVisible();
  await expect(mobileNavigation.getByRole("button", { name: "Profile" })).toBeVisible();
  await expect(mobileNavigation.getByRole("button", { name: "Regeln" })).toBeVisible();
  await expect(mobileNavigation.getByRole("button", { name: "Pflanzungen" })).toBeVisible();
  await expect(mobileNavigation.getByRole("button", { name: "Druckbögen" })).toBeVisible();
  await expect(mobileNavigation.getByText("Aktives Profil")).toBeVisible();
  await expect(mobileNavigation.getByText(`Berlin Mobil ${stamp}`)).toBeVisible();

  await page.getByRole("button", { name: "Katalog" }).click();
  await expect(page.getByRole("button", { name: "Navigation öffnen" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Sorten und Chargen pflegen." })).toBeVisible();

  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page.getByRole("button", { name: "Druckbögen" }).click();
  await expect(page.getByRole("button", { name: "Navigation öffnen" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "A4-Druckbögen für Dein Saatgut." })).toBeVisible();

  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("button", { name: "Navigation öffnen" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("heading", { name: "Mit dem Gartenjahr planen." })).toBeVisible();

  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page.getByRole("button", { name: "Regeln" }).click();
  await expect(page.getByRole("heading", { name: "Aussaatfenster festlegen." })).toBeVisible();

  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page.getByRole("button", { name: "Pflanzungen" }).click();
  await expect(page.getByRole("heading", { name: "Arbeit im Beet festhalten." })).toBeVisible();

  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page.getByRole("button", { name: "Übersicht" }).click();
  await expect(page.getByText("14-Tage-Kalender")).toBeVisible();
});
