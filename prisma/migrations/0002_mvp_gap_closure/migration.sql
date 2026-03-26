-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PlantingJournalEntryType" AS ENUM (
    'OBSERVATION',
    'TASK_NOTE',
    'PEST_NOTE',
    'WEATHER_NOTE',
    'HARVEST_NOTE',
    'SEED_SAVED'
);

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Variety"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlantingJournalEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "varietyId" TEXT,
    "seedBatchId" TEXT,
    "plantingEventId" TEXT,
    "entryType" "PlantingJournalEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" "SeedQuantityUnit",
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantingJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "invitedByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantingJournalEntry_workspaceId_entryDate_idx" ON "PlantingJournalEntry"("workspaceId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_tokenHash_key" ON "UserInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvite_workspaceId_email_status_idx" ON "UserInvite"("workspaceId", "email", "status");

-- AddForeignKey
ALTER TABLE "PlantingJournalEntry" ADD CONSTRAINT "PlantingJournalEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingJournalEntry" ADD CONSTRAINT "PlantingJournalEntry_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingJournalEntry" ADD CONSTRAINT "PlantingJournalEntry_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantingJournalEntry" ADD CONSTRAINT "PlantingJournalEntry_plantingEventId_fkey" FOREIGN KEY ("plantingEventId") REFERENCES "PlantingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
