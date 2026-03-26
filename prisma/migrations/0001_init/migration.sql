-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "WorkspaceVisibility" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SpeciesCategory" AS ENUM ('VEGETABLE', 'FRUIT', 'HERB', 'FLOWER', 'OTHER');

-- CreateEnum
CREATE TYPE "SeedQuantityUnit" AS ENUM ('SEEDS', 'PACKETS', 'GRAMS');

-- CreateEnum
CREATE TYPE "PlantingEventType" AS ENUM ('SOW_INDOORS', 'SOW_OUTDOORS', 'TRANSPLANT', 'HARVEST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "WorkspaceVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "latinName" TEXT,
    "category" "SpeciesCategory" NOT NULL DEFAULT 'VEGETABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variety" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "heirloom" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VarietySynonym" (
    "id" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VarietySynonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedBatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "source" TEXT,
    "harvestYear" INTEGER,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "SeedQuantityUnit" NOT NULL DEFAULT 'SEEDS',
    "storageLocation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowingProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastFrostDate" TIMESTAMP(3) NOT NULL,
    "firstFrostDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultivationRule" (
    "id" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "sowIndoorsStartWeeks" INTEGER,
    "sowIndoorsEndWeeks" INTEGER,
    "sowOutdoorsStartWeeks" INTEGER,
    "sowOutdoorsEndWeeks" INTEGER,
    "transplantStartWeeks" INTEGER,
    "transplantEndWeeks" INTEGER,
    "harvestStartDays" INTEGER,
    "harvestEndDays" INTEGER,
    "spacingCm" INTEGER,
    "successionIntervalDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CultivationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "varietyId" TEXT NOT NULL,
    "seedBatchId" TEXT,
    "growingProfileId" TEXT,
    "type" "PlantingEventType" NOT NULL,
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "quantityUsed" DECIMAL(10,2),
    "locationNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE INDEX "Variety_workspaceId_name_idx" ON "Variety"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VarietySynonym_varietyId_name_key" ON "VarietySynonym"("varietyId", "name");

-- CreateIndex
CREATE INDEX "SeedBatch_workspaceId_varietyId_idx" ON "SeedBatch"("workspaceId", "varietyId");

-- CreateIndex
CREATE INDEX "GrowingProfile_workspaceId_isActive_idx" ON "GrowingProfile"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CultivationRule_varietyId_key" ON "CultivationRule"("varietyId");

-- CreateIndex
CREATE INDEX "PlantingEvent_workspaceId_plannedDate_idx" ON "PlantingEvent"("workspaceId", "plannedDate");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Species" ADD CONSTRAINT "Species_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variety" ADD CONSTRAINT "Variety_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variety" ADD CONSTRAINT "Variety_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VarietySynonym" ADD CONSTRAINT "VarietySynonym_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedBatch" ADD CONSTRAINT "SeedBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedBatch" ADD CONSTRAINT "SeedBatch_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowingProfile" ADD CONSTRAINT "GrowingProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultivationRule" ADD CONSTRAINT "CultivationRule_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingEvent" ADD CONSTRAINT "PlantingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingEvent" ADD CONSTRAINT "PlantingEvent_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingEvent" ADD CONSTRAINT "PlantingEvent_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingEvent" ADD CONSTRAINT "PlantingEvent_growingProfileId_fkey" FOREIGN KEY ("growingProfileId") REFERENCES "GrowingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

