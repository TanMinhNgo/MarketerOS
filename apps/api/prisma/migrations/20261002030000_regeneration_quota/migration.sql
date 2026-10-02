BEGIN;

ALTER TABLE "Generation" DROP CONSTRAINT "generation_outputs_valid";

-- Existing single-variant TEXT generations now use the same grouped pricing.
UPDATE "Generation" SET "quotaUnits" = 0
WHERE "kind" = 'TEXT' AND "requestedOutputs" = 1;

ALTER TABLE "Generation" ADD CONSTRAINT "generation_outputs_valid" CHECK (
  "requestedOutputs" > 0 AND "completedOutputs" >= 0
  AND "completedOutputs" <= "requestedOutputs"
  AND (
    ("kind" = 'TEXT' AND "requestedOutputs" = 1 AND "quotaUnits" = 0)
    OR (NOT ("kind" = 'TEXT' AND "requestedOutputs" = 1) AND "quotaUnits" > 0)
  )
  AND ("status" <> 'SUCCEEDED' OR "completedOutputs" = "requestedOutputs")
);

COMMIT;
