-- CreateEnum
CREATE TYPE "StorageLightExposure" AS ENUM ('DARK', 'INDIRECT', 'BRIGHT');

-- CreateEnum
CREATE TYPE "StorageMoistureLevel" AS ENUM ('DRY', 'MODERATE', 'HUMID');

-- CreateEnum
CREATE TYPE "SeedBatchTransactionType" AS ENUM ('INITIAL_STOCK', 'PLANTING_CONSUMPTION', 'MANUAL_CORRECTION', 'REVERSAL');

-- AlterTable
ALTER TABLE "SeedBatch"
ADD COLUMN "storageTemperatureC" DECIMAL(4,1),
ADD COLUMN "storageHumidityPercent" INTEGER,
ADD COLUMN "storageLightExposure" "StorageLightExposure",
ADD COLUMN "storageMoistureLevel" "StorageMoistureLevel",
ADD COLUMN "storageContainer" TEXT,
ADD COLUMN "storageQualityCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GrowingProfile"
ADD COLUMN "phenologyStage" TEXT,
ADD COLUMN "phenologyObservedAt" TIMESTAMP(3),
ADD COLUMN "phenologyNotes" TEXT;

-- CreateTable
CREATE TABLE "GerminationTest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "seedBatchId" TEXT NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "germinatedCount" INTEGER NOT NULL,
    "germinationRate" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GerminationTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedBatchTransaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "seedBatchId" TEXT NOT NULL,
    "plantingEventId" TEXT,
    "type" "SeedBatchTransactionType" NOT NULL,
    "quantityDelta" DECIMAL(10,2) NOT NULL,
    "quantityBefore" DECIMAL(10,2) NOT NULL,
    "quantityAfter" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedBatchTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GerminationTest_workspaceId_testedAt_idx" ON "GerminationTest"("workspaceId", "testedAt");

-- CreateIndex
CREATE INDEX "GerminationTest_seedBatchId_testedAt_idx" ON "GerminationTest"("seedBatchId", "testedAt");

-- CreateIndex
CREATE INDEX "SeedBatchTransaction_workspaceId_effectiveDate_idx" ON "SeedBatchTransaction"("workspaceId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SeedBatchTransaction_seedBatchId_effectiveDate_idx" ON "SeedBatchTransaction"("seedBatchId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SeedBatchTransaction_reversalOfId_idx" ON "SeedBatchTransaction"("reversalOfId");

-- AddForeignKey
ALTER TABLE "GerminationTest" ADD CONSTRAINT "GerminationTest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GerminationTest" ADD CONSTRAINT "GerminationTest_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedBatchTransaction" ADD CONSTRAINT "SeedBatchTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedBatchTransaction" ADD CONSTRAINT "SeedBatchTransaction_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedBatchTransaction" ADD CONSTRAINT "SeedBatchTransaction_plantingEventId_fkey" FOREIGN KEY ("plantingEventId") REFERENCES "PlantingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
