CREATE TYPE "MediaAssetKind" AS ENUM (
  'VARIETY_REPRESENTATIVE',
  'SEED_BATCH_PACKET',
  'SEED_BATCH_REFERENCE'
);

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "varietyId" TEXT,
  "seedBatchId" TEXT,
  "kind" "MediaAssetKind" NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "altText" TEXT,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE UNIQUE INDEX "MediaAsset_varietyId_kind_key" ON "MediaAsset"("varietyId", "kind");
CREATE INDEX "MediaAsset_workspaceId_kind_createdAt_idx" ON "MediaAsset"("workspaceId", "kind", "createdAt");
CREATE INDEX "MediaAsset_seedBatchId_kind_createdAt_idx" ON "MediaAsset"("seedBatchId", "kind", "createdAt");

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_varietyId_fkey"
  FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_seedBatchId_fkey"
  FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
