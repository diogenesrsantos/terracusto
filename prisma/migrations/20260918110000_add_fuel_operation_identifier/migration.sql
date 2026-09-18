ALTER TABLE "AccountingEntry" ADD COLUMN "operationId" TEXT;
ALTER TABLE "AccountingLine" ADD COLUMN "operationId" TEXT;
ALTER TABLE "FuelDispense" ADD COLUMN "operationId" TEXT;
ALTER TABLE "SupplierLedgerEntry" ADD COLUMN "operationId" TEXT;

UPDATE "FuelDispense" SET "operationId" = "id" WHERE "operationId" IS NULL;

UPDATE "AccountingEntry" AS entry
SET "operationId" = dispense."operationId"
FROM "FuelDispense" AS dispense
WHERE dispense."entryId" = entry."id";

UPDATE "AccountingLine" AS line
SET "operationId" = entry."operationId"
FROM "AccountingEntry" AS entry
WHERE line."entryId" = entry."id" AND entry."operationId" IS NOT NULL;

UPDATE "SupplierLedgerEntry" AS ledger
SET "operationId" = dispense."operationId"
FROM "FuelDispense" AS dispense
WHERE ledger."dispenseId" = dispense."id";

ALTER TABLE "FuelDispense" ALTER COLUMN "operationId" SET NOT NULL;
CREATE UNIQUE INDEX "FuelDispense_operationId_key" ON "FuelDispense"("operationId");
CREATE INDEX "AccountingEntry_operationId_idx" ON "AccountingEntry"("operationId");
CREATE INDEX "AccountingLine_operationId_idx" ON "AccountingLine"("operationId");
CREATE INDEX "SupplierLedgerEntry_operationId_idx" ON "SupplierLedgerEntry"("operationId");
