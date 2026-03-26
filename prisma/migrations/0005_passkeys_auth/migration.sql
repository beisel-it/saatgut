ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User"
  ADD COLUMN "webauthnUserId" TEXT;

CREATE UNIQUE INDEX "User_webauthnUserId_key" ON "User"("webauthnUserId");

CREATE TYPE "PasskeyDeviceType" AS ENUM ('SINGLE_DEVICE', 'MULTI_DEVICE');

CREATE TABLE "PasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" INTEGER NOT NULL,
  "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "deviceType" "PasskeyDeviceType" NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");
CREATE INDEX "PasskeyCredential_userId_createdAt_idx" ON "PasskeyCredential"("userId", "createdAt");

ALTER TABLE "PasskeyCredential"
  ADD CONSTRAINT "PasskeyCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
