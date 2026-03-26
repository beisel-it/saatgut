import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, email: string, password: string, workspaceName: string) {
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email,
      password,
      workspaceName,
    },
  });

  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();
}

async function browserPost<T>(page: Page, baseURL: string, path: string, data: unknown) {
  const response = await page.context().request.post(`${baseURL}${path}`, { data });

  expect(response.ok(), `${path} should succeed`).toBeTruthy();

  return (await response.json()) as T;
}

async function openWorkspaceManager(page: Page) {
  await page.getByRole("button", { name: "Arbeitsbereich & Konto" }).click();
  await expect(page.getByRole("heading", { name: "Arbeitsbereich gemeinsam verwalten." })).toBeVisible();
}

async function closeWorkspaceManager(page: Page) {
  await page.getByRole("button", { name: "Schließen" }).click();
  await expect(page.getByRole("heading", { name: "Arbeitsbereich gemeinsam verwalten." })).toHaveCount(0);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.locator("form").first().getByLabel("E-Mail")).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: "Anmelden" }).first().click();

  const authForm = page.locator("form").first();
  await authForm.getByLabel("E-Mail").fill(email);
  await authForm.getByLabel("Passwort").fill(password);
  await authForm.getByRole("button", { name: "Anmelden" }).click();
}

test.describe("workspace collaboration and own account management", () => {
  test.setTimeout(120_000);

  test("supports invites, acceptance, shared access, member management, and password changes", async ({
    browser,
    baseURL,
  }) => {
    const stamp = Date.now().toString();
    const workspaceName = `Kollektiv Garten ${stamp}`;
    const ownerEmail = `owner-${stamp}@example.com`;
    const ownerPassword = "correct horse battery staple";
    const collaboratorEmail = `member-${stamp}@example.com`;
    const collaboratorPassword = "summer garden password";
    const collaboratorNewPassword = "updated summer garden password";
    const varietyName = `Geteilte Sorte ${stamp}`;

    const ownerContext = await browser.newContext();
    const collaboratorContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const collaboratorPage = await collaboratorContext.newPage();

    await registerWorkspace(ownerPage, baseURL!, ownerEmail, ownerPassword, workspaceName);

    const species = await browserPost<{ id: string }>(ownerPage, baseURL!, "/api/v1/species", {
      commonName: `Tomate ${stamp}`,
      latinName: "Solanum lycopersicum",
      category: "VEGETABLE",
      notes: "Geteilte Art fuer Kollaborations-QA",
    });

    const variety = await browserPost<{ id: string }>(ownerPage, baseURL!, "/api/v1/varieties", {
      speciesId: species.id,
      name: varietyName,
      description: "Sichtbar fuer eingeladenen Zugriff",
      heirloom: true,
      tags: ["team"],
      notes: "Von der Inhaberin angelegt",
      synonyms: [],
    });

    await browserPost(ownerPage, baseURL!, "/api/v1/seed-batches", {
      varietyId: variety.id,
      source: "Gemeinschaftsbestand",
      harvestYear: 2025,
      quantity: 24,
      unit: "SEEDS",
      storageLocation: "Regal A",
      notes: "Freigegebene Charge",
    });

    await openWorkspaceManager(ownerPage);

    const inviteForm = ownerPage
      .locator("section, div")
      .filter({ has: ownerPage.getByRole("heading", { name: "Mitgärtner:in einladen" }) })
      .first();
    await inviteForm.getByLabel("E-Mail der eingeladenen Person").fill(collaboratorEmail);
    await inviteForm.getByLabel("Rolle im Arbeitsbereich").selectOption("MEMBER");
    await inviteForm.getByLabel("Gültig für Tage").fill("7");
    await inviteForm.getByRole("button", { name: "Einladung erstellen" }).click();

    await expect(ownerPage.getByText("Einladung erstellt.")).toBeVisible();
    await expect(ownerPage.locator("body")).toContainText(collaboratorEmail);

    const inviteToken = (await ownerPage.locator("p.font-mono").first().textContent())?.trim();
    expect(inviteToken).toBeTruthy();

    const acceptanceResponse = await collaboratorPage.context().request.post(
      `${baseURL}/api/v1/workspace/invites/accept`,
      {
        data: {
          token: inviteToken,
          password: collaboratorPassword,
        },
      },
    );
    expect(acceptanceResponse.ok()).toBeTruthy();

    await collaboratorPage.goto("/");
    await expect(collaboratorPage.getByRole("heading", { name: workspaceName })).toBeVisible();

    await collaboratorPage.getByRole("button", { name: "Katalog" }).click();
    await expect(collaboratorPage.locator("body")).toContainText(varietyName);

    await openWorkspaceManager(collaboratorPage);
    await expect(collaboratorPage.getByText(ownerEmail)).toHaveCount(0);
    await expect(collaboratorPage.getByRole("heading", { name: "Mitgärtner:in einladen" })).toHaveCount(0);
    await expect(collaboratorPage.getByRole("heading", { name: "Mitglieder im Arbeitsbereich" })).toHaveCount(0);
    await expect(collaboratorPage.locator("body")).toContainText(collaboratorEmail);
    await expect(collaboratorPage.locator("body")).toContainText("Mitglied");

    await collaboratorPage.getByLabel("Aktuelles Passwort").fill(collaboratorPassword);
    await collaboratorPage.getByLabel("Neues Passwort", { exact: true }).fill(collaboratorNewPassword);
    await collaboratorPage.getByLabel("Neues Passwort bestätigen", { exact: true }).fill(collaboratorNewPassword);
    await collaboratorPage.getByRole("button", { name: "Passwort aktualisieren" }).click();
    await expect(collaboratorPage.getByText("Passwort aktualisiert.")).toBeVisible();

    await closeWorkspaceManager(collaboratorPage);
    await signOut(collaboratorPage);

    await signIn(collaboratorPage, collaboratorEmail, collaboratorPassword);
    await expect(collaboratorPage.locator("form").first().getByLabel("E-Mail")).toBeVisible();
    await expect(collaboratorPage.getByRole("heading", { name: workspaceName })).toHaveCount(0);

    await signIn(collaboratorPage, collaboratorEmail, collaboratorNewPassword);
    await expect(collaboratorPage.getByRole("heading", { name: workspaceName })).toBeVisible();

    await closeWorkspaceManager(ownerPage);
    await openWorkspaceManager(ownerPage);
    const collaboratorMemberRow = ownerPage
      .locator("article")
      .filter({ has: ownerPage.getByText(collaboratorEmail) })
      .filter({ has: ownerPage.getByRole("combobox") })
      .first();
    await collaboratorMemberRow.getByRole("combobox").selectOption("VIEWER");
    await collaboratorMemberRow.getByRole("button", { name: "Rolle speichern" }).click();
    await expect(ownerPage.getByText("Mitgliedsrolle aktualisiert.")).toBeVisible();
    await expect(collaboratorMemberRow).toContainText("Lesend");

    await collaboratorPage.reload();
    await openWorkspaceManager(collaboratorPage);
    await expect(collaboratorPage.locator("body")).toContainText("Lesend");
    await closeWorkspaceManager(collaboratorPage);

    ownerPage.once("dialog", (dialog) => dialog.accept());
    await collaboratorMemberRow.getByRole("button", { name: "Zugang entfernen" }).click();
    await expect(ownerPage.getByText("Mitglied entfernt.")).toBeVisible();
    await expect(collaboratorMemberRow).toHaveCount(0);

    await signOut(collaboratorPage);
    await signIn(collaboratorPage, collaboratorEmail, collaboratorNewPassword);
    await expect(collaboratorPage.locator("form").first().getByLabel("E-Mail")).toBeVisible();
    await expect(collaboratorPage.getByRole("heading", { name: workspaceName })).toHaveCount(0);

    const ownerSession = await ownerPage.context().request.get(`${baseURL}/api/v1/auth/session`);
    expect(ownerSession.ok()).toBeTruthy();
    await ownerContext.close();
    await collaboratorContext.close();
  });
});
