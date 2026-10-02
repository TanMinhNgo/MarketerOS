ALTER TABLE "ContentItem" DROP CONSTRAINT "content_schedule_valid";

-- A draft can retain its previous schedule while waiting for re-approval.
ALTER TABLE "ContentItem" ADD CONSTRAINT "content_schedule_valid" CHECK (
  "status" IN ('DRAFT', 'DONE')
  OR ("status" = 'READY' AND "scheduledAt" IS NULL)
  OR ("status" = 'SCHEDULED' AND "scheduledAt" IS NOT NULL)
);
