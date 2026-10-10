CREATE TABLE "AssistantActionExecution" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "imageRequestId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "contentId" TEXT,
  "assetId" TEXT,
  "baseDone" BOOLEAN NOT NULL DEFAULT false,
  "targetAssetIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contentUpdatedAt" TIMESTAMPTZ(3),
  "lease" TEXT,
  "errorCode" TEXT,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AssistantActionExecution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantActionExecution_status_check" CHECK ("status" IN ('pending', 'running', 'partial', 'applied')),
  CONSTRAINT "AssistantActionExecution_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AssistantMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AssistantActionExecution_imageRequestId_key" ON "AssistantActionExecution"("imageRequestId");
CREATE UNIQUE INDEX "AssistantActionExecution_messageId_actionId_key" ON "AssistantActionExecution"("messageId", "actionId");
