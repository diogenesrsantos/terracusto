CREATE TYPE "FuelSupplySource" AS ENUM ('INTERNAL_TANK', 'DIRECT_SUPPLIER');
CREATE TYPE "FuelMeasurementStatus" AS ENUM ('DRAFT', 'CLOSED', 'CANCELED');

ALTER TABLE "AccountingEntry" ALTER COLUMN "workId" DROP NOT NULL;
ALTER TABLE "FuelPurchase" ALTER COLUMN "workId" DROP NOT NULL;
ALTER TABLE "FuelDispense" ALTER COLUMN "tankId" DROP NOT NULL;

ALTER TABLE "FuelDispense"
ADD COLUMN "source" "FuelSupplySource" NOT NULL DEFAULT 'INTERNAL_TANK',
ADD COLUMN "document" TEXT,
ADD COLUMN "unitPrice" DECIMAL(12,4),
ADD COLUMN "paymentTerm" "FuelPaymentTerm",
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "reimbursable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reimbursementAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "supplierId" TEXT,
ADD COLUMN "measurementId" TEXT;

ALTER TABLE "SupplierLedgerEntry"
ADD COLUMN "dispenseId" TEXT,
ADD COLUMN "dueDate" TIMESTAMP(3);

UPDATE "SupplierLedgerEntry"
SET "dueDate" = "date"
WHERE "credit" > 0 AND "dueDate" IS NULL;

CREATE TABLE "SupplierPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE SEQUENCE "FuelMeasurement_number_seq";
CREATE TABLE "FuelMeasurement" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL DEFAULT nextval('"FuelMeasurement_number_seq"'),
    "competence" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "FuelMeasurementStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "workId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entryId" TEXT,
    "createdById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelMeasurement_pkey" PRIMARY KEY ("id")
);
ALTER SEQUENCE "FuelMeasurement_number_seq" OWNED BY "FuelMeasurement"."number";

CREATE UNIQUE INDEX "SupplierLedgerEntry_dispenseId_key" ON "SupplierLedgerEntry"("dispenseId");
CREATE UNIQUE INDEX "SupplierPaymentAllocation_paymentId_payableId_key" ON "SupplierPaymentAllocation"("paymentId", "payableId");
CREATE INDEX "SupplierPaymentAllocation_payableId_idx" ON "SupplierPaymentAllocation"("payableId");
CREATE INDEX "FuelDispense_supplierId_date_idx" ON "FuelDispense"("supplierId", "date");
CREATE INDEX "FuelDispense_measurementId_idx" ON "FuelDispense"("measurementId");
CREATE UNIQUE INDEX "FuelMeasurement_number_key" ON "FuelMeasurement"("number");
CREATE UNIQUE INDEX "FuelMeasurement_entryId_key" ON "FuelMeasurement"("entryId");
CREATE UNIQUE INDEX "FuelMeasurement_workId_competence_key" ON "FuelMeasurement"("workId", "competence");
CREATE INDEX "FuelMeasurement_companyId_competence_idx" ON "FuelMeasurement"("companyId", "competence");
CREATE INDEX "FuelMeasurement_status_competence_idx" ON "FuelMeasurement"("status", "competence");

ALTER TABLE "FuelDispense" ADD CONSTRAINT "FuelDispense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelDispense" ADD CONSTRAINT "FuelDispense_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "FuelMeasurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "FuelDispense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "SupplierLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelMeasurement" ADD CONSTRAINT "FuelMeasurement_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelMeasurement" ADD CONSTRAINT "FuelMeasurement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FuelMeasurement" ADD CONSTRAINT "FuelMeasurement_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
DECLARE
  payment_row RECORD;
  payable_row RECORD;
  remaining DECIMAL(14,2);
  allocated DECIMAL(14,2);
BEGIN
  FOR payment_row IN
    SELECT * FROM "SupplierLedgerEntry"
    WHERE "debit" > 0
    ORDER BY "supplierId", "date", "createdAt"
  LOOP
    remaining := payment_row."debit";
    FOR payable_row IN
      SELECT payable."id",
             payable."credit" - COALESCE(SUM(allocation."amount"), 0) AS outstanding
      FROM "SupplierLedgerEntry" payable
      LEFT JOIN "SupplierPaymentAllocation" allocation ON allocation."payableId" = payable."id"
      WHERE payable."supplierId" = payment_row."supplierId"
        AND payable."credit" > 0
        AND payable."date" <= payment_row."date"
      GROUP BY payable."id"
      HAVING payable."credit" - COALESCE(SUM(allocation."amount"), 0) > 0
      ORDER BY payable."dueDate" NULLS LAST, payable."date", payable."createdAt"
    LOOP
      EXIT WHEN remaining <= 0;
      allocated := LEAST(remaining, payable_row.outstanding);
      INSERT INTO "SupplierPaymentAllocation" ("id", "paymentId", "payableId", "amount")
      VALUES ('backfill-' || md5(payment_row."id" || ':' || payable_row."id"), payment_row."id", payable_row."id", allocated)
      ON CONFLICT DO NOTHING;
      remaining := remaining - allocated;
    END LOOP;
  END LOOP;
END $$;

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
SELECT 'fuel-reimbursement-account', '3.2.2', 'Reembolso de combustíveis', 'CREDIT', true, true, parent."id"
FROM "Account" parent
WHERE parent."code" = '3.2'
  AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '3.2.2');

INSERT INTO "EntryType" ("id", "name", "active", "requiresAsset", "requiresPerson", "forFuelDispense", "defaultDebitAccountId", "defaultCreditAccountId", "createdAt", "updatedAt")
SELECT 'fuel-reimbursement-entry-type', 'Reembolso de combustíveis', true, false, false, false,
       debit."id", credit."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Account" debit, "Account" credit
WHERE debit."code" = '1.2' AND credit."code" = '3.2.2'
  AND NOT EXISTS (SELECT 1 FROM "EntryType" WHERE "name" = 'Reembolso de combustíveis');
