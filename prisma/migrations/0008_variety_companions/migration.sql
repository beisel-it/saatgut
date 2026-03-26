CREATE TABLE "VarietyCompanion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "primaryVarietyId" TEXT NOT NULL,
  "secondaryVarietyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VarietyCompanion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VarietyCompanion_variety_pair_order" CHECK ("primaryVarietyId" < "secondaryVarietyId")
);

CREATE UNIQUE INDEX "VarietyCompanion_workspaceId_primaryVarietyId_secondaryVar_key"
  ON "VarietyCompanion"("workspaceId", "primaryVarietyId", "secondaryVarietyId");
CREATE INDEX "VarietyCompanion_workspaceId_primaryVarietyId_idx"
  ON "VarietyCompanion"("workspaceId", "primaryVarietyId");
CREATE INDEX "VarietyCompanion_workspaceId_secondaryVarietyId_idx"
  ON "VarietyCompanion"("workspaceId", "secondaryVarietyId");

ALTER TABLE "VarietyCompanion"
  ADD CONSTRAINT "VarietyCompanion_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VarietyCompanion"
  ADD CONSTRAINT "VarietyCompanion_primaryVarietyId_fkey"
  FOREIGN KEY ("primaryVarietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VarietyCompanion"
  ADD CONSTRAINT "VarietyCompanion_secondaryVarietyId_fkey"
  FOREIGN KEY ("secondaryVarietyId") REFERENCES "Variety"("id") ON DELETE CASCADE ON UPDATE CASCADE;
