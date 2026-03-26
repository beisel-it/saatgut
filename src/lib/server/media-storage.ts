import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";
import { ApiError } from "@/lib/server/api-error";

const supportedMimeTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function getStorageRoot() {
  return path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
}

function sanitizeFilename(name: string) {
  const base = path.basename(name || "upload");
  return base.replace(/[^\w.-]+/g, "_").slice(0, 120) || "upload";
}

export function assertSupportedImageUpload(file: File) {
  if (!supportedMimeTypes.has(file.type)) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JPEG, PNG, and WebP images are supported.", {
      mimeType: file.type || null,
    });
  }

  if (file.size <= 0) {
    throw new ApiError(422, "EMPTY_UPLOAD", "Uploaded media file is empty.");
  }

  if (file.size > env.MEDIA_MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "UPLOAD_TOO_LARGE", "Uploaded media file exceeds the configured size limit.", {
      maxBytes: env.MEDIA_MAX_UPLOAD_BYTES,
      byteSize: file.size,
    });
  }
}

export async function storeImageUpload(file: File) {
  assertSupportedImageUpload(file);

  const extension = supportedMimeTypes.get(file.type)!;
  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `${randomUUID()}${extension}`;
  const targetPath = path.join(getStorageRoot(), storageKey);

  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(targetPath, buffer);

  return {
    storageKey,
    originalFilename: sanitizeFilename(file.name),
    mimeType: file.type,
    byteSize: buffer.byteLength,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function deleteStoredMedia(storageKey: string) {
  await rm(path.join(getStorageRoot(), storageKey), { force: true });
}

export async function readStoredMedia(storageKey: string) {
  return readFile(path.join(getStorageRoot(), storageKey));
}
