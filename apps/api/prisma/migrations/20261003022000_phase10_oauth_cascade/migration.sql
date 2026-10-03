ALTER TABLE "IntegrationOAuthSession"
  ADD CONSTRAINT "IntegrationOAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "IntegrationOAuthSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "IntegrationOAuthSession_userId_idx" ON "IntegrationOAuthSession"("userId");
CREATE INDEX "IntegrationOAuthSession_projectId_idx" ON "IntegrationOAuthSession"("projectId");
