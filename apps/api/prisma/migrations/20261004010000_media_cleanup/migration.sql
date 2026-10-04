CREATE TABLE "MediaDeletion" (
    "id" SERIAL NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaDeletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaDeletion_storageKey_key" ON "MediaDeletion"("storageKey");

CREATE FUNCTION queue_asset_object_deletion() RETURNS trigger AS $$
BEGIN
  INSERT INTO "MediaDeletion" ("storageKey") VALUES (OLD."storageKey")
  ON CONFLICT ("storageKey") DO NOTHING;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_object_deletion
AFTER DELETE ON "Asset"
FOR EACH ROW EXECUTE FUNCTION queue_asset_object_deletion();
