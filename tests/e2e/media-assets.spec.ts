import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

type MediaAsset = {
  id: string;
  kind: "VARIETY_REPRESENTATIVE" | "SEED_BATCH_PACKET" | "SEED_BATCH_REFERENCE";
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  altText: string | null;
  caption: string | null;
  contentUrl: string;
};

type VarietyRecord = {
  id: string;
  name: string;
  representativeImage: MediaAsset | null;
};

const PNG_IMAGE = {
  name: "rote-murmel.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=", "base64"),
};

const JPEG_IMAGE = {
  name: "rote-murmel-neu.jpg",
  mimeType: "image/jpeg",
  buffer: Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBAQEA8PEA8PDw8PDw8PDw8QDw8PFREWFhURFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGy0fICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAgMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAApA//xAAZEAEAAwEBAAAAAAAAAAAAAAABAAIREzH/2gAIAQEAAQUCl7m6f//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8BP//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8BP//EABkQAQADAQEAAAAAAAAAAAAAAAEAESExQf/aAAgBAQAGPwKFs8r/xAAaEAADAQEBAQAAAAAAAAAAAAAAAREhMUFR/9oACAEBAAE/IZKJ4qrkH4WQ3//Z",
    "base64",
  ),
};

async function registerWorkspace(page: Page, baseURL: string, suffix: string) {
  const workspaceName = `QA Medien ${suffix}`;
  const response = await page.context().request.post(`${baseURL}/api/v1/auth/register`, {
    data: {
      email: `qa-media-${suffix}@example.com`,
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

async function getVariety(page: Page, varietyId: string) {
  const varieties = await browserCollection<VarietyRecord>(page, "/api/v1/varieties");
  const variety = varieties.find((entry) => entry.id === varietyId);
  expect(variety).toBeTruthy();
  return variety!;
}

async function getBatchPhotos(page: Page, seedBatchId: string) {
  return browserCollection<MediaAsset>(page, `/api/v1/seed-batches/${seedBatchId}/photos`);
}

async function expectVarietyImage(page: Page, varietyId: string, matcher: (asset: MediaAsset | null) => void | Promise<void>) {
  await expect.poll(async () => {
    try {
      const variety = await getVariety(page, varietyId);
      await matcher(variety.representativeImage);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }).toBe("");
}

async function expectBatchPhotos(page: Page, seedBatchId: string, matcher: (photos: MediaAsset[]) => void | Promise<void>) {
  await expect.poll(async () => {
    try {
      const photos = await getBatchPhotos(page, seedBatchId);
      await matcher(photos);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }).toBe("");
}

function sectionFromText(locator: Locator, text: string) {
  return locator.getByText(text, { exact: true }).locator("xpath=ancestor::section[1]");
}

test("variety and seed-batch media flows support upload, replacement, preview, removal, and constraints", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now().toString();
  const varietyName = `Rote Murmel ${stamp}`;
  const batchSource = `Saatgutarchiv ${stamp}`;

  await registerWorkspace(page, baseURL!, stamp);

  const species = await browserPost<{ id: string }>(page, "/api/v1/species", {
    commonName: "Tomate",
    latinName: "Solanum lycopersicum",
    category: "VEGETABLE",
    notes: "Medien-QA",
  });
  const variety = await browserPost<{ id: string }>(page, "/api/v1/varieties", {
    speciesId: species.id,
    name: varietyName,
    description: "Sorte fuer Medien-QA",
    heirloom: true,
    tags: ["foto"],
    notes: "Varietynotiz",
  });
  const seedBatch = await browserPost<{ id: string }>(page, "/api/v1/seed-batches", {
    varietyId: variety.id,
    source: batchSource,
    harvestYear: 2025,
    quantity: 24,
    unit: "SEEDS",
    storageLocation: "Regal Foto",
    notes: "Charge fuer Medien-QA",
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Katalog" }).click();

  const varietyCard = page.locator("details").filter({ has: page.getByRole("heading", { name: varietyName }) }).first();
  await varietyCard.locator("summary").click();

  const varietyImageSection = sectionFromText(varietyCard, "Sortenbild");
  const varietyImageForm = varietyImageSection.locator("form");
  const batchCard = varietyCard.locator("article").first();
  const batchPhotoForm = batchCard.locator("form").first();

  await expect(varietyImageSection).toContainText("Noch kein repräsentatives Sortenbild hinterlegt.");
  await varietyImageForm.getByRole("button", { name: "Bild hochladen" }).click();
  await expect(varietyImageSection).toContainText("Wähle zuerst eine Bilddatei aus.");

  await varietyImageForm.getByLabel("Bilddatei").setInputFiles({
    name: "notiz.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("kein bild"),
  });
  await varietyImageForm.getByRole("button", { name: "Bild hochladen" }).click();
  await expect(varietyImageSection).toContainText("Nur JPEG-, PNG- oder WebP-Bilder werden unterstützt.");

  await varietyImageForm.getByLabel("Bilddatei").setInputFiles({
    name: "zu-gross.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
  });
  await varietyImageForm.getByRole("button", { name: "Bild hochladen" }).click();
  await expect(varietyImageSection).toContainText("Die Bilddatei ist zu groß. Wähle bitte eine kleinere Datei.");

  await varietyImageForm.getByLabel("Bilddatei").setInputFiles(PNG_IMAGE);
  await varietyImageForm.getByLabel("Kurzbeschreibung").fill("Rote Murmel Packung");
  await varietyImageForm.getByLabel("Bildnotiz").fill("Erstes Sortenbild");
  await varietyImageForm.getByRole("button", { name: "Bild hochladen" }).click();

  await expect(varietyImageSection).toContainText("Sortenbild gespeichert.");
  await expect(varietyImageSection.locator('img[alt="Rote Murmel Packung"]')).toBeVisible();
  await expect(varietyImageSection).toContainText("Erstes Sortenbild");

  let representativeImage: MediaAsset | null = null;
  await expectVarietyImage(page, variety.id, (asset) => {
    expect(asset).not.toBeNull();
    expect(asset?.kind).toBe("VARIETY_REPRESENTATIVE");
    expect(asset?.mimeType).toBe("image/png");
    expect(asset?.altText).toBe("Rote Murmel Packung");
    expect(asset?.caption).toBe("Erstes Sortenbild");
    representativeImage = asset;
  });

  const firstVarietyImage = representativeImage!;
  const firstVarietyContent = await page.context().request.get(`${baseURL}${firstVarietyImage.contentUrl}`);
  expect(firstVarietyContent.ok()).toBeTruthy();
  expect(firstVarietyContent.headers()["content-type"]).toContain("image/png");
  expect(firstVarietyContent.headers()["content-disposition"]).toContain(firstVarietyImage.originalFilename);

  await varietyImageForm.getByLabel("Bilddatei").setInputFiles(JPEG_IMAGE);
  await varietyImageForm.getByLabel("Kurzbeschreibung").fill("Rote Murmel neu");
  await varietyImageForm.getByLabel("Bildnotiz").fill("Ersetztes Sortenbild");
  await varietyImageForm.getByRole("button", { name: "Bild ersetzen" }).click();

  await expect(varietyImageSection).toContainText("Sortenbild gespeichert.");
  await expect(varietyImageSection.locator('img[alt="Rote Murmel neu"]')).toBeVisible();
  await expect(varietyImageSection).toContainText("Ersetztes Sortenbild");

  await expectVarietyImage(page, variety.id, (asset) => {
    expect(asset).not.toBeNull();
    expect(asset?.id).not.toBe(firstVarietyImage.id);
    expect(asset?.mimeType).toBe("image/jpeg");
    expect(asset?.altText).toBe("Rote Murmel neu");
    expect(asset?.caption).toBe("Ersetztes Sortenbild");
  });

  await varietyImageSection.getByRole("button", { name: "Bild entfernen" }).click();
  await expect(varietyImageSection).toContainText("Sortenbild entfernt.");
  await expect(varietyImageSection).toContainText("Noch kein repräsentatives Sortenbild hinterlegt.");
  await expectVarietyImage(page, variety.id, (asset) => {
    expect(asset).toBeNull();
  });

  await expect(batchCard).toContainText("Noch kein Packungsfoto hinterlegt.");
  await expect(batchCard).toContainText("Noch kein Referenzfoto hinterlegt.");

  await batchPhotoForm.getByRole("button", { name: "Foto speichern" }).click();
  await expect(batchCard).toContainText("Wähle zuerst eine Bilddatei aus.");

  await batchPhotoForm.getByLabel("Bilddatei").setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("kein bild"),
  });
  await batchPhotoForm.getByRole("button", { name: "Foto speichern" }).click();
  await expect(batchCard).toContainText("Nur JPEG-, PNG- oder WebP-Bilder werden unterstützt.");

  await batchPhotoForm.getByLabel("Fototyp").selectOption("SEED_BATCH_PACKET");
  await batchPhotoForm.getByLabel("Bilddatei").setInputFiles(JPEG_IMAGE);
  await batchPhotoForm.getByLabel("Kurzbeschreibung").fill("Packung Vorderseite");
  await batchPhotoForm.getByLabel("Bildnotiz").fill("Erstes Packungsfoto");
  await batchPhotoForm.getByRole("button", { name: "Foto speichern" }).click();

  await expect(batchCard).toContainText("Chargenfoto gespeichert.");
  await expect(batchCard.locator('img[alt="Packung Vorderseite"]')).toBeVisible();
  await expect(batchCard).toContainText("Erstes Packungsfoto");

  let packetPhoto: MediaAsset | undefined;
  await expectBatchPhotos(page, seedBatch.id, (photos) => {
    expect(photos).toHaveLength(1);
    expect(photos[0].kind).toBe("SEED_BATCH_PACKET");
    expect(photos[0].mimeType).toBe("image/jpeg");
    expect(photos[0].altText).toBe("Packung Vorderseite");
    packetPhoto = photos[0];
  });

  const packetContent = await page.context().request.get(`${baseURL}${packetPhoto!.contentUrl}`);
  expect(packetContent.ok()).toBeTruthy();
  expect(packetContent.headers()["content-type"]).toContain("image/jpeg");
  expect(packetContent.headers()["content-disposition"]).toContain(packetPhoto!.originalFilename);

  await batchPhotoForm.getByLabel("Fototyp").selectOption("SEED_BATCH_PACKET");
  await batchPhotoForm.getByLabel("Bilddatei").setInputFiles(PNG_IMAGE);
  await batchPhotoForm.getByLabel("Kurzbeschreibung").fill("Packung Rueckseite");
  await batchPhotoForm.getByLabel("Bildnotiz").fill("Ersetztes Packungsfoto");
  await batchPhotoForm.getByRole("button", { name: "Foto speichern" }).click();

  await expect(batchCard).toContainText("Chargenfoto gespeichert.");
  await expect(batchCard.locator('img[alt="Packung Rueckseite"]')).toBeVisible();
  await expect(batchCard).toContainText("Ersetztes Packungsfoto");

  await expectBatchPhotos(page, seedBatch.id, (photos) => {
    expect(photos).toHaveLength(1);
    expect(photos[0].kind).toBe("SEED_BATCH_PACKET");
    expect(photos[0].id).not.toBe(packetPhoto?.id);
    expect(photos[0].mimeType).toBe("image/png");
  });

  await batchCard.getByRole("button", { name: "Bild entfernen" }).click();
  await expect(batchCard).toContainText("Chargenfoto entfernt.");
  await expect(batchCard).toContainText("Noch kein Packungsfoto hinterlegt.");
  await expectBatchPhotos(page, seedBatch.id, (photos) => {
    expect(photos).toHaveLength(0);
  });

  await batchPhotoForm.getByLabel("Fototyp").selectOption("SEED_BATCH_REFERENCE");
  await batchPhotoForm.getByLabel("Bilddatei").setInputFiles(PNG_IMAGE);
  await batchPhotoForm.getByLabel("Kurzbeschreibung").fill("Saatgutprobe Makro");
  await batchPhotoForm.getByLabel("Bildnotiz").fill("Referenzbild fuer die Charge");
  await batchPhotoForm.getByRole("button", { name: "Foto speichern" }).click();

  await expect(batchCard).toContainText("Chargenfoto gespeichert.");
  await expect(batchCard.locator('img[alt="Saatgutprobe Makro"]')).toBeVisible();
  await expect(batchCard).toContainText("Referenzbild fuer die Charge");

  await expectBatchPhotos(page, seedBatch.id, (photos) => {
    expect(photos).toHaveLength(1);
    expect(photos[0].kind).toBe("SEED_BATCH_REFERENCE");
    expect(photos[0].mimeType).toBe("image/png");
    expect(photos[0].altText).toBe("Saatgutprobe Makro");
  });

  await batchCard.getByRole("button", { name: "Bild entfernen" }).click();
  await expect(batchCard).toContainText("Chargenfoto entfernt.");
  await expect(batchCard).toContainText("Noch kein Referenzfoto hinterlegt.");
  await expectBatchPhotos(page, seedBatch.id, (photos) => {
    expect(photos).toHaveLength(0);
  });
});
