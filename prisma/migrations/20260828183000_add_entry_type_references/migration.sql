ALTER TABLE "EntryType" ADD COLUMN "requiresAsset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EntryType" ADD COLUMN "requiresPerson" BOOLEAN NOT NULL DEFAULT false;

UPDATE "EntryType"
SET "requiresAsset" = true, "requiresPerson" = true
WHERE "name" = 'Serviço de máquinas';
