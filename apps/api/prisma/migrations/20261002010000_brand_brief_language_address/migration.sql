ALTER TABLE "BrandBrief"
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'vi',
  ADD COLUMN "businessAddress" TEXT;

ALTER TABLE "BrandBrief"
  ADD CONSTRAINT "brand_brief_language_valid"
  CHECK ("language" IN ('vi', 'en', 'zh', 'ja', 'ko', 'th', 'id', 'fr', 'es', 'de')),
  ADD CONSTRAINT "brand_brief_business_address_valid"
  CHECK (
    "businessAddress" IS NULL
    OR (char_length("businessAddress") <= 300 AND btrim("businessAddress") <> '')
  );
