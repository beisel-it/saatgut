import { MembershipRole, MediaAssetKind, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ApiError } from "@/lib/server/api-error";
import type { AuthContext } from "@/lib/server/auth-context";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteStoredMedia, readStoredMedia, storeImageUpload } from "@/lib/server/media-storage";
import { serializeMediaAsset } from "@/lib/server/serializers";

type DbClient = PrismaClient | Prisma.TransactionClient;

function requireWriteAccess(auth: AuthContext) {
  if (auth.membershipRole === MembershipRole.VIEWER) {
    throw new ApiError(403, "WRITE_ACCESS_DENIED", "This workspace membership is read-only.");
  }
}

async function assertVarietyInWorkspace(db: DbClient, workspaceId: string, varietyId: string) {
  const variety = await db.variety.findFirst({
    where: { id: varietyId, workspaceId },
  });

  if (!variety) {
    throw new ApiError(404, "VARIETY_NOT_FOUND", "Variety was not found in this workspace.");
  }

  return variety;
}

async function assertSeedBatchInWorkspace(db: DbClient, workspaceId: string, seedBatchId: string) {
  const seedBatch = await db.seedBatch.findFirst({
    where: { id: seedBatchId, workspaceId },
  });

  if (!seedBatch) {
    throw new ApiError(404, "SEED_BATCH_NOT_FOUND", "Seed batch was not found in this workspace.");
  }

  return seedBatch;
}

export async function replaceVarietyRepresentativeImage(
  auth: AuthContext,
  varietyId: string,
  input: {
    file: File;
    altText?: string | null;
    caption?: string | null;
  },
) {
  requireWriteAccess(auth);
  const stored = await storeImageUpload(input.file);
  let replacedStorageKey: string | null = null;

  try {
    const asset = await prisma.$transaction(async (tx) => {
      await assertVarietyInWorkspace(tx, auth.workspaceId, varietyId);

      const existing = await tx.mediaAsset.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          varietyId,
          kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
        },
      });

      if (existing) {
        replacedStorageKey = existing.storageKey;
        await tx.mediaAsset.delete({
          where: { id: existing.id },
        });
      }

      const asset = await tx.mediaAsset.create({
        data: {
          workspaceId: auth.workspaceId,
          varietyId,
          kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
          originalFilename: stored.originalFilename,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          altText: input.altText ?? null,
          caption: input.caption ?? null,
        },
      });

      await writeAuditLog(tx, auth, "variety.media.replace", "MediaAsset", asset.id, {
        varietyId,
        kind: asset.kind,
        originalFilename: asset.originalFilename,
        checksumSha256: stored.checksumSha256,
      });

      return asset;
    });

    if (replacedStorageKey) {
      await deleteStoredMedia(replacedStorageKey);
    }

    return asset;
  } catch (error) {
    await deleteStoredMedia(stored.storageKey);
    throw error;
  }
}

export async function deleteVarietyRepresentativeImage(auth: AuthContext, varietyId: string) {
  requireWriteAccess(auth);

  const asset = await prisma.$transaction(async (tx) => {
    await assertVarietyInWorkspace(tx, auth.workspaceId, varietyId);

    const asset = await tx.mediaAsset.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        varietyId,
        kind: MediaAssetKind.VARIETY_REPRESENTATIVE,
      },
    });

    if (!asset) {
      throw new ApiError(404, "MEDIA_ASSET_NOT_FOUND", "Representative variety image was not found.");
    }

    await tx.mediaAsset.delete({
      where: { id: asset.id },
    });

    await writeAuditLog(tx, auth, "variety.media.delete", "MediaAsset", asset.id, {
      varietyId,
      kind: asset.kind,
      originalFilename: asset.originalFilename,
    });

    return asset;
  });

  await deleteStoredMedia(asset.storageKey);
  return asset;
}

export async function listSeedBatchPhotos(auth: AuthContext, seedBatchId: string) {
  await assertSeedBatchInWorkspace(prisma, auth.workspaceId, seedBatchId);

  return prisma.mediaAsset.findMany({
    where: {
      workspaceId: auth.workspaceId,
      seedBatchId,
      kind: {
        in: [MediaAssetKind.SEED_BATCH_PACKET, MediaAssetKind.SEED_BATCH_REFERENCE],
      },
    },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
}

export async function addSeedBatchPhoto(
  auth: AuthContext,
  seedBatchId: string,
  input: {
    file: File;
    kind: "SEED_BATCH_PACKET" | "SEED_BATCH_REFERENCE";
    altText?: string | null;
    caption?: string | null;
  },
) {
  requireWriteAccess(auth);
  const stored = await storeImageUpload(input.file);

  try {
    return await prisma.$transaction(async (tx) => {
      await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);

      const asset = await tx.mediaAsset.create({
        data: {
          workspaceId: auth.workspaceId,
          seedBatchId,
          kind: input.kind,
          originalFilename: stored.originalFilename,
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          altText: input.altText ?? null,
          caption: input.caption ?? null,
        },
      });

      await writeAuditLog(tx, auth, "seedBatch.media.create", "MediaAsset", asset.id, {
        seedBatchId,
        kind: asset.kind,
        originalFilename: asset.originalFilename,
        checksumSha256: stored.checksumSha256,
      });

      return asset;
    });
  } catch (error) {
    await deleteStoredMedia(stored.storageKey);
    throw error;
  }
}

export async function deleteSeedBatchPhoto(auth: AuthContext, seedBatchId: string, photoId: string) {
  requireWriteAccess(auth);

  const asset = await prisma.$transaction(async (tx) => {
    await assertSeedBatchInWorkspace(tx, auth.workspaceId, seedBatchId);

    const asset = await tx.mediaAsset.findFirst({
      where: {
        id: photoId,
        workspaceId: auth.workspaceId,
        seedBatchId,
        kind: {
          in: [MediaAssetKind.SEED_BATCH_PACKET, MediaAssetKind.SEED_BATCH_REFERENCE],
        },
      },
    });

    if (!asset) {
      throw new ApiError(404, "MEDIA_ASSET_NOT_FOUND", "Seed batch photo was not found.");
    }

    await tx.mediaAsset.delete({
      where: { id: asset.id },
    });

    await writeAuditLog(tx, auth, "seedBatch.media.delete", "MediaAsset", asset.id, {
      seedBatchId,
      kind: asset.kind,
      originalFilename: asset.originalFilename,
    });

    return asset;
  });

  await deleteStoredMedia(asset.storageKey);
  return asset;
}

export async function getMediaAssetContent(auth: AuthContext, mediaId: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      workspaceId: auth.workspaceId,
    },
  });

  if (!asset) {
    throw new ApiError(404, "MEDIA_ASSET_NOT_FOUND", "Media asset was not found in this workspace.");
  }

  const content = await readStoredMedia(asset.storageKey).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new ApiError(404, "MEDIA_CONTENT_MISSING", "Stored media file was not found on disk.");
    }

    throw error;
  });

  return {
    asset,
    content,
  };
}

export function serializeMediaCollection(items: Array<Parameters<typeof serializeMediaAsset>[0]>) {
  return { items: items.map(serializeMediaAsset) };
}
