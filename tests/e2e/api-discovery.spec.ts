import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const email = `qa-api-discovery-${suffix}@example.com`;
  const workspaceName = `QA API Discovery ${suffix}`;

  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email,
      password: "correct horse battery staple",
      workspaceName,
    },
  });

  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  return { email, workspaceName };
}

async function openWorkspaceManager(page: Page) {
  await page.getByRole("button", { name: "Arbeitsbereich & Konto" }).click();
  await expect(page.getByRole("heading", { name: "Arbeitsbereich gemeinsam verwalten." })).toBeVisible();
}

async function openPowerTools(page: Page) {
  await page.locator("summary").filter({ hasText: "Schnittstellen und Werkzeuge" }).click();
  await expect(page.getByRole("heading", { name: "Referenzen und Rohschema" })).toBeVisible();
}

test("api discovery, MCP guidance, and api-token management work for owners while viewers stay read-only", async ({
  browser,
  page,
  baseURL,
  request,
}) => {
  const stamp = Date.now().toString();
  const { workspaceName } = await registerWorkspace(page, baseURL!, stamp);

  await expect(page.locator("main")).toContainText("API-Referenz");
  await expect(page.locator("main")).toContainText("OpenAPI JSON");

  await page.goto("/api-reference");
  await expect(page.getByRole("heading", { name: "API-Oberfläche durchsuchen." })).toBeVisible();
  await expect(page.locator("body")).toContainText("Power-User Referenz");
  await expect(page.locator("body")).toContainText("MCP und Agenten");
  await expect(page.locator("body")).toContainText("/api/v1/mcp");
  await expect(page.locator("body")).toContainText("/api/v1/admin/api-tokens");
  await expect(page.getByRole("link", { name: "Zurück zur App" })).toBeVisible();

  const openApiResponse = await request.get(`${baseURL}/api/v1/openapi.json`);
  expect(openApiResponse.ok()).toBeTruthy();
  const openApi = await openApiResponse.json();
  expect(openApi.paths["/mcp"]).toBeTruthy();
  expect(openApi.paths["/admin/api-tokens"]).toBeTruthy();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  await openWorkspaceManager(page);
  await openPowerTools(page);

  await expect(page.locator("body")).toContainText("Diese Angaben helfen beim Verbinden eines lokalen Agenten");
  await expect(page.locator("body")).toContainText("1. Lege zuerst einen API-Schlüssel");
  await expect(page.locator("body")).toContainText("2. Nutze den MCP-Endpunkt");
  await expect(page.locator("body")).toContainText("3. Teste danach die Verbindung");
  await expect(page.locator("body")).toContainText("Endpunkt:");
  await expect(page.locator("body")).toContainText("/api/v1/mcp");
  await expect(page.locator("body")).toContainText("Transport:");
  await expect(page.locator("body")).toContainText("streamable-http");
  await expect(page.locator("body")).toContainText("Protokoll:");
  await expect(page.locator("body")).toContainText("2025-06-18");
  await expect(page.locator("body")).toContainText("Authentifizierung:");
  await expect(page.locator("body")).toContainText("API-token only");
  await expect(page.locator("body")).toContainText("Erlaubte Ursprünge");
  await expect(page.locator("body")).toContainText("http://localhost:3019");

  const tokenForm = page.locator("form").filter({ hasText: "Name des Schlüssels" }).first();

  await tokenForm.getByLabel("Name des Schlüssels").fill(`Docs Token ${stamp}`);
  await tokenForm.getByLabel("Gültig für TageOptional").fill("30");
  await tokenForm.getByLabel("Anfragen pro MinuteOptional").fill("45");
  await tokenForm.getByText("Lesen").click();
  await tokenForm.getByText("Admin").click();
  await tokenForm.getByRole("button", { name: "API-Schlüssel erstellen" }).click();

  await expect(page.getByText("API-Schlüssel erstellt.")).toBeVisible();
  await expect(page.getByText("Der geheime Token-Wert wird nur direkt nach dem Erstellen angezeigt.")).toBeVisible();

  const latestTokenSecret = (await page.locator(".font-mono").first().textContent())?.trim();
  expect(latestTokenSecret).toBeTruthy();
  await expect(page.locator("body")).toContainText("Docs Token");
  await expect(page.locator("body")).toContainText("ADMIN");
  await expect(page.locator("body")).toContainText("Anfragen pro Minute: 45");

  const mcpMetadataResponse = await request.get(`${baseURL}/api/v1/mcp`);
  expect(mcpMetadataResponse.ok()).toBeTruthy();
  expect(mcpMetadataResponse.headers()["x-saatgut-mcp-protocol"]).toBe("2025-06-18");

  const mcpInitializeResponse = await request.post(`${baseURL}/api/v1/mcp`, {
    headers: {
      Authorization: `Bearer ${latestTokenSecret}`,
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    },
  });
  expect(mcpInitializeResponse.ok()).toBeTruthy();
  const mcpInitialize = await mcpInitializeResponse.json();
  expect(mcpInitialize.result.protocolVersion).toBe("2025-06-18");

  const ownerRequest = page.context().request;
  const inviteResponse = await ownerRequest.post("/api/v1/workspace/invites", {
    data: {
      email: `viewer-${stamp}@example.com`,
      role: "VIEWER",
      expiresInDays: 7,
    },
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const invitePayload = await inviteResponse.json();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();

  try {
    const acceptResponse = await viewerContext.request.post(`${baseURL}/api/v1/workspace/invites/accept`, {
      data: {
        token: invitePayload.token,
        password: "correct horse battery staple",
      },
    });
    expect(acceptResponse.ok()).toBeTruthy();

    await viewerPage.goto("/");
    await expect(viewerPage.getByRole("heading", { name: workspaceName })).toBeVisible();

    await openWorkspaceManager(viewerPage);
    await openPowerTools(viewerPage);

    await expect(viewerPage.getByRole("heading", { name: "Power-User-Zugänge" })).toBeVisible();
    await expect(viewerPage.locator("body")).toContainText("Du kannst die Referenzen und Serverhinweise lesen.");
    await expect(viewerPage.getByRole("button", { name: "API-Schlüssel erstellen" })).toHaveCount(0);
    await expect(viewerPage.locator("body")).not.toContainText("Zugänge für Werkzeuge verwalten");
    await expect(viewerPage.locator("body")).toContainText("Server-Einstellungen prüfen");
    await expect(viewerPage.locator("body")).toContainText("Referenzen und Rohschema");
  } finally {
    await viewerContext.close();
  }

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Widerrufen" }).click();
  await expect(page.getByText("API-Schlüssel widerrufen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Widerrufen" })).toBeDisabled();
  await expect(page.locator("body")).toContainText("Widerrufen");

  const revokedInitializeResponse = await request.post(`${baseURL}/api/v1/mcp`, {
    headers: {
      Authorization: `Bearer ${latestTokenSecret}`,
    },
    data: {
      jsonrpc: "2.0",
      id: 2,
      method: "initialize",
      params: {},
    },
  });
  expect(revokedInitializeResponse.status()).toBe(401);
});
