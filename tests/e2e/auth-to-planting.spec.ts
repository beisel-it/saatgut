import { expect, test } from "@playwright/test";

test("user can complete the seed-bank MVP flow from auth to planting", async ({ page }) => {
  const stamp = Date.now();
  const email = `qa-${stamp}@example.com`;
  const workspaceName = `QA Workspace ${stamp}`;
  const speciesName = `Tomato ${stamp}`;
  const varietyName = `Roma ${stamp}`;
  const profileName = `Berlin Spring ${stamp}`;

  await page.goto("/");

  const authForm = page.locator("form").first();
  await authForm.getByLabel("Email").fill(email);
  await authForm.getByLabel("Password").fill("correct horse battery staple");
  await authForm.getByLabel("Workspace name").fill(workspaceName);
  await authForm.getByRole("button", { name: "Create workspace" }).click();

  await expect(page.getByRole("heading", { name: workspaceName })).toBeVisible();

  await page.getByRole("button", { name: "Catalog" }).click();

  const speciesForm = page.locator("form").nth(0);
  await speciesForm.getByLabel("Common name").fill(speciesName);
  await speciesForm.getByLabel("Latin name").fill("Solanum lycopersicum");
  await speciesForm.getByLabel("Notes").fill("QA species note");
  await speciesForm.getByRole("button", { name: "Save species" }).click();

  await expect(page.getByText("Species saved.")).toBeVisible();
  await expect(page.locator("body")).toContainText(speciesName);

  const varietyForm = page.locator("form").nth(1);
  await varietyForm.getByLabel("Species").selectOption({ label: speciesName });
  await varietyForm.getByLabel("Variety name").fill(varietyName);
  await varietyForm.getByLabel("Synonyms").fill("Plum test");
  await varietyForm.getByLabel("Heirloom or conservation variety").check();
  await varietyForm.getByLabel("Description").fill("QA variety description");
  await varietyForm.getByRole("button", { name: "Save variety" }).click();

  await expect(page.getByText("Variety saved.")).toBeVisible();
  await expect(page.locator("body")).toContainText(varietyName);

  const batchForm = page.locator("form").nth(2);
  await batchForm.getByLabel("Variety").selectOption({ label: varietyName });
  await batchForm.getByLabel("Quantity").fill("100");
  await batchForm.getByLabel("Unit").selectOption("SEEDS");
  await batchForm.getByLabel("Harvest year").fill("2025");
  await batchForm.getByLabel("Source").fill("Seed Saver");
  await batchForm.getByLabel("Storage location").fill("Cold shelf");
  await batchForm.getByRole("button", { name: "Save seed batch" }).click();

  await expect(page.getByText("Seed batch saved.")).toBeVisible();
  await expect(page.getByText("100 seeds")).toBeVisible();

  await page.getByRole("button", { name: "Profiles" }).click();

  const profileForm = page.locator("form").first();
  await profileForm.getByLabel("Profile name").fill(profileName);
  await profileForm.getByLabel("Last frost date").fill("2026-04-09");
  await profileForm.getByLabel("First frost date").fill("2026-10-15");
  await profileForm.getByLabel("Notes").fill("QA active profile");
  await profileForm.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByText("Growing profile saved.")).toBeVisible();
  await expect(page.locator("body")).toContainText(profileName);

  await page.getByRole("button", { name: "Rules" }).click();

  const ruleForm = page.locator("form").first();
  await ruleForm.getByLabel("Variety").selectOption({ label: varietyName });
  await ruleForm.getByLabel("Indoor sowing start").fill("2");
  await ruleForm.getByLabel("Indoor sowing end").fill("0");
  await ruleForm.getByLabel("Harvest start").fill("60");
  await ruleForm.getByLabel("Harvest end").fill("80");
  await ruleForm.getByRole("button", { name: "Save rule" }).click();

  await expect(page.getByText("Cultivation rule saved.")).toBeVisible();

  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Refresh workspace" }).click();

  await expect(page.getByText("14-day calendar")).toBeVisible();
  await expect(page.getByText(varietyName)).toBeVisible();

  await page.getByRole("button", { name: "Plantings" }).click();

  const plantingForm = page.locator("form").first();
  await plantingForm.getByLabel("Variety").selectOption({ label: varietyName });
  await plantingForm.getByLabel("Type").selectOption("SOW_INDOORS");
  await plantingForm.getByLabel("Growing profile").selectOption({ label: profileName });

  const seedBatchSelect = plantingForm.getByLabel("Seed batch");
  const batchOptions = await seedBatchSelect.locator("option").allTextContents();
  const batchLabel = batchOptions.find(
    (option) => option.includes(varietyName) && option.includes("100 seeds"),
  );

  expect(batchLabel).toBeTruthy();
  await seedBatchSelect.selectOption({ label: batchLabel! });

  await plantingForm.getByLabel("Quantity used").fill("12");
  await plantingForm.getByLabel("Actual date").fill("2026-03-26");
  await plantingForm.getByLabel("Location note").fill("Greenhouse tray A");
  await plantingForm.getByRole("button", { name: "Save planting event" }).click();

  await expect(page.getByText("Planting event saved.")).toBeVisible();
  await expect(page.getByText("Greenhouse tray A")).toBeVisible();

  await page.getByRole("button", { name: "Catalog" }).click();
  await expect(page.getByText("88 seeds")).toBeVisible();
});
