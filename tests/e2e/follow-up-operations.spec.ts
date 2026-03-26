import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const email = `qa-followup-${suffix}@example.com`;
  const workspaceName = `QA Follow-up ${suffix}`;

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

test("follow-up admin, search, quality, reminder, export, api docs, and MCP surfaces work", async ({
  page,
  request,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  await registerWorkspace(page, baseURL!, stamp);

  const browserRequest = page.context().request;

  const speciesResponse = await browserRequest.post("/api/v1/species", {
    data: {
      commonName: `Pepper ${stamp}`,
      latinName: "Capsicum annuum",
      category: "VEGETABLE",
      notes: "Follow-up QA species",
    },
  });
  expect(speciesResponse.ok()).toBeTruthy();
  const species = await speciesResponse.json();

  const varietyResponse = await browserRequest.post("/api/v1/varieties", {
    data: {
      speciesId: species.id,
      name: `Paprika ${stamp}`,
      description: "Follow-up QA variety",
      heirloom: true,
      tags: ["sweet", "qa"],
      notes: "Taggable variety",
      synonyms: ["QA Pepper"],
    },
  });
  expect(varietyResponse.ok()).toBeTruthy();
  const variety = await varietyResponse.json();

  const batchResponse = await browserRequest.post("/api/v1/seed-batches", {
    data: {
      varietyId: variety.id,
      source: "Seed Library",
      harvestYear: 2025,
      quantity: 50,
      unit: "SEEDS",
      storageLocation: "Basement shelf",
      storageTemperatureC: 8,
      storageHumidityPercent: 32,
      storageLightExposure: "DARK",
      storageMoistureLevel: "DRY",
      storageContainer: "Glass jar",
      storageQualityCheckedAt: "2026-03-26T10:00:00.000Z",
      notes: "Cool and dark",
    },
  });
  expect(batchResponse.ok()).toBeTruthy();
  const seedBatch = await batchResponse.json();

  const germinationResponse = await browserRequest.post(
    `/api/v1/seed-batches/${seedBatch.id}/germination-tests`,
    {
      data: {
        testedAt: "2026-03-26T10:00:00.000Z",
        sampleSize: 10,
        germinatedCount: 8,
        notes: "Good vigor",
      },
    },
  );
  expect(germinationResponse.ok()).toBeTruthy();
  const germinationTest = await germinationResponse.json();
  expect(germinationTest.germinationRate).toBe("80");

  const varietySearchResponse = await browserRequest.get(
    `/api/v1/varieties?q=${encodeURIComponent("Paprika")}&tag=qa&heirloom=true`,
  );
  expect(varietySearchResponse.ok()).toBeTruthy();
  const varietySearch = await varietySearchResponse.json();
  expect(varietySearch.items).toHaveLength(1);
  expect(varietySearch.items[0].id).toBe(variety.id);

  const journalResponse = await browserRequest.post("/api/v1/journal", {
    data: {
      varietyId: variety.id,
      seedBatchId: seedBatch.id,
      entryType: "OBSERVATION",
      title: "Seedlings look vigorous",
      details: "Strong germination and even cotyledons.",
      entryDate: "2026-03-26T10:00:00.000Z",
      tags: ["qa-journal", "vigorous"],
    },
  });
  expect(journalResponse.ok()).toBeTruthy();

  const journalSearchResponse = await browserRequest.get(
    `/api/v1/journal?q=${encodeURIComponent("vigorous")}&tag=qa-journal`,
  );
  expect(journalSearchResponse.ok()).toBeTruthy();
  const journalSearch = await journalSearchResponse.json();
  expect(journalSearch.items).toHaveLength(1);

  const reminderResponse = await browserRequest.post("/api/v1/tasks", {
    data: {
      title: "Check seedling moisture",
      details: "Follow up after germination test",
      dueDate: "2026-03-28T09:00:00.000Z",
      source: "QUALITY",
      tags: ["qa-reminder", "moisture"],
      seedBatchId: seedBatch.id,
      varietyId: variety.id,
    },
  });
  expect(reminderResponse.ok()).toBeTruthy();
  const reminderTask = await reminderResponse.json();

  const filteredTaskResponse = await browserRequest.get("/api/v1/tasks?status=PENDING&tag=qa-reminder");
  expect(filteredTaskResponse.ok()).toBeTruthy();
  const filteredTasks = await filteredTaskResponse.json();
  expect(filteredTasks.items.map((item: { id: string }) => item.id)).toContain(reminderTask.id);

  const inviteResponse = await browserRequest.post("/api/v1/admin/invites", {
    data: {
      email: `invite-${stamp}@example.com`,
      role: "MEMBER",
      expiresInDays: 7,
    },
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const invitePayload = await inviteResponse.json();
  expect(invitePayload.token).toBeTruthy();

  const acceptResponse = await request.post(`${baseURL}/api/v1/admin/invites/accept`, {
    data: {
      token: invitePayload.token,
      password: "correct horse battery staple",
    },
  });
  expect(acceptResponse.ok()).toBeTruthy();

  const adminUsersResponse = await browserRequest.get("/api/v1/admin/users");
  expect(adminUsersResponse.ok()).toBeTruthy();
  const adminUsers = await adminUsersResponse.json();
  const invitedMembership = adminUsers.memberships.find(
    (membership: { user: { email: string; id: string; isActive: boolean } }) =>
      membership.user.email === `invite-${stamp}@example.com`,
  );
  expect(invitedMembership).toBeTruthy();
  expect(invitedMembership.user.isActive).toBe(true);

  const deactivateResponse = await browserRequest.post(
    `/api/v1/admin/users/${invitedMembership.user.id}/deactivate`,
  );
  expect(deactivateResponse.ok()).toBeTruthy();
  const deactivatedPayload = await deactivateResponse.json();
  expect(deactivatedPayload.user.isActive).toBe(false);

  const apiTokenResponse = await browserRequest.post("/api/v1/admin/api-tokens", {
    data: {
      name: `QA token ${stamp}`,
      scopes: ["READ", "WRITE", "EXPORT", "ADMIN"],
      rateLimitPerMinute: 120,
      expiresInDays: 30,
    },
  });
  expect(apiTokenResponse.ok()).toBeTruthy();
  const apiTokenPayload = await apiTokenResponse.json();
  expect(apiTokenPayload.token.length).toBeGreaterThan(20);

  const exportResponse = await request.get(`${baseURL}/api/v1/exports/workspace`, {
    headers: {
      Authorization: `Bearer ${apiTokenPayload.token}`,
    },
  });
  expect(exportResponse.ok()).toBeTruthy();
  expect(exportResponse.headers()["content-disposition"]).toContain("workspace-export-");
  const exportPayload = await exportResponse.json();
  expect(exportPayload.varieties.length).toBeGreaterThanOrEqual(1);

  const openApiResponse = await request.get(`${baseURL}/api/v1/openapi.json`);
  expect(openApiResponse.ok()).toBeTruthy();
  const openApi = await openApiResponse.json();
  expect(openApi.paths["/mcp"]).toBeTruthy();
  expect(openApi.paths["/admin/api-tokens"]).toBeTruthy();

  const mcpMetadataResponse = await request.get(`${baseURL}/api/v1/mcp`);
  expect(mcpMetadataResponse.ok()).toBeTruthy();
  expect(mcpMetadataResponse.headers()["x-saatgut-mcp-protocol"]).toBe("2025-06-18");

  const mcpInitializeResponse = await request.post(`${baseURL}/api/v1/mcp`, {
    headers: {
      Authorization: `Bearer ${apiTokenPayload.token}`,
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
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("remains navigable on a narrow mobile viewport", async ({ page, baseURL }) => {
    const stamp = `${Date.now()}-mobile`;
    await registerWorkspace(page, baseURL!, stamp);

    await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Catalog" }).click();
    await expect(page.getByRole("heading", { name: "Seed batches", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Profiles" }).click();
    await expect(page.getByRole("heading", { name: "Growing profiles", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Plantings" }).click();
    await expect(page.getByRole("heading", { name: "Planting events", exact: true })).toBeVisible();
  });
});
