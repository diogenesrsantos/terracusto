CREATE TYPE "FuelTankKind" AS ENUM ('FIXED', 'MOBILE');
CREATE TYPE "FuelPaymentTerm" AS ENUM ('CASH', 'CREDIT');

CREATE TABLE "FuelTank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FuelTankKind" NOT NULL,
    "capacity" DECIMAL(14,3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "fuelTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelTank_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FuelPurchase" ADD COLUMN "tankId" TEXT;
ALTER TABLE "FuelPurchase" ADD COLUMN "paymentTerm" "FuelPaymentTerm" NOT NULL DEFAULT 'CASH';
ALTER TABLE "FuelDispense" ADD COLUMN "tankId" TEXT;

INSERT INTO "FuelTank" ("id", "name", "kind", "capacity", "fuelTypeId")
SELECT 'legacy-tank-' || ft."id", 'Tanque legado - ' || ft."name", 'FIXED',
       GREATEST(COALESCE((SELECT SUM(fp."liters") FROM "FuelPurchase" fp WHERE fp."fuelTypeId" = ft."id"), 0), 1),
       ft."id"
FROM "FuelType" ft;

UPDATE "FuelPurchase" fp SET "tankId" = 'legacy-tank-' || fp."fuelTypeId";
UPDATE "FuelDispense" fd SET "tankId" = 'legacy-tank-' || fd."fuelTypeId";
ALTER TABLE "FuelPurchase" ALTER COLUMN "tankId" SET NOT NULL;
ALTER TABLE "FuelDispense" ALTER COLUMN "tankId" SET NOT NULL;

CREATE TABLE "SupplierLedgerEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "document" TEXT,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplierId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "entryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FuelTank_name_key" ON "FuelTank"("name");
CREATE INDEX "FuelTank_fuelTypeId_active_idx" ON "FuelTank"("fuelTypeId", "active");
CREATE INDEX "FuelPurchase_tankId_date_idx" ON "FuelPurchase"("tankId", "date");
CREATE INDEX "FuelDispense_tankId_date_idx" ON "FuelDispense"("tankId", "date");
CREATE UNIQUE INDEX "SupplierLedgerEntry_purchaseId_key" ON "SupplierLedgerEntry"("purchaseId");
CREATE UNIQUE INDEX "SupplierLedgerEntry_entryId_key" ON "SupplierLedgerEntry"("entryId");
CREATE INDEX "SupplierLedgerEntry_supplierId_date_idx" ON "SupplierLedgerEntry"("supplierId", "date");

ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_fuelTypeId_fkey" FOREIGN KEY ("fuelTypeId") REFERENCES "FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelPurchase" ADD CONSTRAINT "FuelPurchase_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "FuelTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelDispense" ADD CONSTRAINT "FuelDispense_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "FuelTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "FuelPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
