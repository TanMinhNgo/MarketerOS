CREATE UNIQUE INDEX "Publication_one_active_per_content" ON "Publication"("contentId")
  WHERE "contentId" IS NOT NULL AND "source" = 'MARKETOS' AND "status" IN ('QUEUED', 'PUBLISHING');
