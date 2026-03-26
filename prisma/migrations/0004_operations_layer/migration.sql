-- CreateEnum
CREATE TYPE "ReminderTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReminderTaskSource" AS ENUM ('MANUAL', 'CALENDAR', 'JOURNAL', 'QUALITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApiTokenScope" AS ENUM ('READ', 'WRITE', 'EXPORT', 'ADMIN');

-- CreateTable
CREATE TABLE "ReminderTask" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "varietyId" TEXT,
    "seedBatchId" TEXT,
    "plantingEventId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReminderTaskStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReminderTaskSource" NOT NULL DEFAULT 'MANUAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scopes" "ApiTokenScope"[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderTask_workspaceId_dueDate_idx" ON "ReminderTask"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "ReminderTask_workspaceId_status_dueDate_idx" ON "ReminderTask"("workspaceId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ReminderTask_assignedUserId_status_dueDate_idx" ON "ReminderTask"("assignedUserId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ApiToken_workspaceId_revokedAt_createdAt_idx" ON "ApiToken"("workspaceId", "revokedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ApiToken_createdByUserId_revokedAt_idx" ON "ApiToken"("createdByUserId", "revokedAt");

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "Variety"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderTask" ADD CONSTRAINT "ReminderTask_plantingEventId_fkey" FOREIGN KEY ("plantingEventId") REFERENCES "PlantingEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
