-- AlterEnum
ALTER TYPE "GenerationKind" ADD VALUE 'AUTOMATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingPlan" TEXT NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "AssistantMessage" ADD COLUMN     "automationId" TEXT;

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "schedule" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "nextRunAt" TIMESTAMPTZ(3),
    "lastRunAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "generationId" TEXT,
    "scheduledFor" TIMESTAMPTZ(3),
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "summary" TEXT,
    "createdContentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledContentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assistantMessageId" TEXT,
    "error" JSONB,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_enabled_nextRunAt_idx" ON "Automation"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "Automation_projectId_createdAt_id_idx" ON "Automation"("projectId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_generationId_key" ON "AutomationRun"("generationId");

-- CreateIndex
CREATE INDEX "AutomationRun_automationId_createdAt_id_idx" ON "AutomationRun"("automationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AutomationRun_status_createdAt_idx" ON "AutomationRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_automationId_scheduledFor_key" ON "AutomationRun"("automationId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "user_billing_plan_valid" CHECK ("billingPlan" IN ('free', 'pro', 'max'));
ALTER TABLE "Automation" ADD CONSTRAINT "automation_valid" CHECK (
  length("name") BETWEEN 1 AND 80
  AND "type" IN ('write_posts', 'schedule_ready', 'weekly_report', 'custom_prompt')
  AND jsonb_typeof("schedule") = 'object' AND jsonb_typeof("config") = 'object'
  AND (("enabled" AND "nextRunAt" IS NOT NULL) OR (NOT "enabled" AND "nextRunAt" IS NULL))
);
ALTER TABLE "AutomationRun" ADD CONSTRAINT "automation_run_valid" CHECK (
  "trigger" IN ('schedule', 'manual')
  AND (("trigger" = 'schedule' AND "scheduledFor" IS NOT NULL) OR ("trigger" = 'manual' AND "scheduledFor" IS NULL))
  AND "status" IN ('queued', 'running', 'succeeded', 'failed', 'skipped')
  AND (("status" = 'queued' AND "startedAt" IS NULL AND "finishedAt" IS NULL)
    OR ("status" = 'running' AND "startedAt" IS NOT NULL AND "finishedAt" IS NULL)
    OR ("status" IN ('succeeded', 'failed', 'skipped') AND "finishedAt" IS NOT NULL))
  AND ("generationId" IS NOT NULL OR "status" = 'skipped')
);
