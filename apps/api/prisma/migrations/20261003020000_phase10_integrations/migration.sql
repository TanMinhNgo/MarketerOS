ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "ConnectionStatus" ADD VALUE IF NOT EXISTS 'ERROR';

ALTER TABLE "ChannelConnection"
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "connectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Publication"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "claimedAt" TIMESTAMPTZ(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3);

CREATE TABLE "IntegrationCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "connectionId" TEXT NOT NULL UNIQUE,
  "ciphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "IntegrationCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "IntegrationOAuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT UNIQUE,
  "ciphertext" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IntegrationOAuthSession_expiresAt_idx" ON "IntegrationOAuthSession"("expiresAt");
CREATE UNIQUE INDEX "ChannelConnection_one_active_per_project_channel" ON "ChannelConnection"("projectId", "channel") WHERE "status" NOT IN ('REVOKED', 'DISCONNECTED');
ALTER TABLE "Publication" ADD CONSTRAINT "publication_attempts_valid" CHECK ("attempts" BETWEEN 0 AND 3);
