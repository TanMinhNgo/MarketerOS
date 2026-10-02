ALTER TYPE "GenerationKind" ADD VALUE 'ASSISTANT';

CREATE TABLE "AssistantMessage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "actions" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_message_valid" CHECK (
    "role" IN ('user', 'assistant') AND length("content") BETWEEN 1 AND 12000
    AND ("role" <> 'user' OR length("content") <= 4000)
    AND jsonb_typeof("actions") = 'array' AND jsonb_array_length("actions") <= 5
    AND ("role" <> 'user' OR "actions" = '[]'::jsonb)
  )
);
CREATE UNIQUE INDEX "AssistantMessage_generationId_role_key" ON "AssistantMessage"("generationId", "role");
CREATE INDEX "AssistantMessage_projectId_createdAt_id_idx" ON "AssistantMessage"("projectId", "createdAt", "id");
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
