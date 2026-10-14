ALTER TABLE "MaintenanceOrder" ADD COLUMN "resolved" BOOLEAN, ADD COLUMN "closingNotes" TEXT, ADD COLUMN "entryId" TEXT;
CREATE UNIQUE INDEX "MaintenanceOrder_entryId_key" ON "MaintenanceOrder"("entryId");
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenancePart" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "MaintenancePart" ADD COLUMN "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "description" TEXT, ADD COLUMN "invoice" TEXT, ADD COLUMN "source" TEXT NOT NULL DEFAULT 'STOCK', ADD COLUMN "operationId" TEXT;
UPDATE "MaintenancePart" p SET "date" = COALESCE(o."finishedAt", o."openedAt") FROM "MaintenanceOrder" o WHERE p."orderId" = o."id";
CREATE UNIQUE INDEX "MaintenancePart_operationId_key" ON "MaintenancePart"("operationId");
CREATE TABLE "MaintenanceService" (
 "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
 "description" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "value" DECIMAL(14,2) NOT NULL,
 CONSTRAINT "MaintenanceService_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MaintenanceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "MaintenanceService_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
SELECT 'maintenance-reimbursement-account', '3.2.3', 'Reembolso de Manutenção', 'CREDIT', true, true, "id" FROM "Account" WHERE "code" = '3.2'
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "EntryType" ("id", "name", "defaultDebitAccountId", "defaultCreditAccountId", "updatedAt")
SELECT 'maintenance-reimbursement-type', 'Reembolso de Manutenção', d."id", c."id", CURRENT_TIMESTAMP FROM "Account" d, "Account" c WHERE d."code" = '1.2' AND c."code" = '3.2.3'
ON CONFLICT ("name") DO NOTHING;
