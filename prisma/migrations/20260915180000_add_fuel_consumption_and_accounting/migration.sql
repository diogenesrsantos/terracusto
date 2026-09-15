CREATE TYPE "ConsumptionMetric" AS ENUM ('LITERS_PER_HOUR', 'KM_PER_LITER');

ALTER TABLE "Asset"
ADD COLUMN "fuelTankCapacity" DECIMAL(14,3),
ADD COLUMN "consumptionMetric" "ConsumptionMetric";

ALTER TABLE "EntryType" ADD COLUMN "forFuelDispense" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "EntryType" ("id", "name", "active", "requiresAsset", "requiresPerson", "forFuelDispense", "defaultDebitAccountId", "defaultCreditAccountId", "createdAt", "updatedAt")
SELECT 'fuel-dispense-default', 'Consumo de combustível da frota', true, true, false, true, debit."id", credit."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Account" debit, "Account" credit
WHERE debit."code" = '4.1' AND credit."code" = '1.3'
  AND NOT EXISTS (SELECT 1 FROM "EntryType" WHERE "name" = 'Consumo de combustível da frota');

UPDATE "EntryType" SET "forFuelDispense" = true
WHERE "name" = 'Consumo de combustível da frota';

ALTER TABLE "FuelDispense"
ADD COLUMN "fullTank" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "meterDelta" DECIMAL(14,2),
ADD COLUMN "consumptionRate" DECIMAL(14,3),
ADD COLUMN "unitCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "entryId" TEXT;

UPDATE "FuelDispense" fd
SET "unitCost" = COALESCE(costs.average_cost, 0),
    "totalCost" = ROUND(fd."liters" * COALESCE(costs.average_cost, 0), 2)
FROM (
  SELECT fp."tankId", CASE WHEN SUM(fp."liters") > 0 THEN SUM(fp."total") / SUM(fp."liters") ELSE 0 END AS average_cost
  FROM "FuelPurchase" fp GROUP BY fp."tankId"
) costs
WHERE costs."tankId" = fd."tankId";

ALTER TABLE "FuelDispense" ALTER COLUMN "fullTank" SET DEFAULT true;
CREATE UNIQUE INDEX "FuelDispense_entryId_key" ON "FuelDispense"("entryId");
ALTER TABLE "FuelDispense" ADD CONSTRAINT "FuelDispense_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
