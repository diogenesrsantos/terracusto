-- Restructure revenue accounts while preserving lines posted to the former 3.1 account.
UPDATE "Account"
SET "name" = 'Serviços', "nature" = 'CREDIT', "analytic" = false
WHERE "code" = '3.1';

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
VALUES ('account-services-machines', '3.1.1', 'Serviços de máquinas', 'CREDIT', true, true, (SELECT "id" FROM "Account" WHERE "code" = '3.1'))
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "nature" = EXCLUDED."nature", "analytic" = true, "active" = true, "parentId" = EXCLUDED."parentId";

UPDATE "AccountingLine"
SET "accountId" = (SELECT "id" FROM "Account" WHERE "code" = '3.1.1')
WHERE "accountId" = (SELECT "id" FROM "Account" WHERE "code" = '3.1');

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
VALUES ('account-reimbursable', '3.2', 'Despesas reembolsáveis', 'CREDIT', false, true, (SELECT "id" FROM "Account" WHERE "code" = '3'))
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "nature" = EXCLUDED."nature", "analytic" = false, "active" = true, "parentId" = EXCLUDED."parentId";

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
VALUES ('account-reimburse-food', '3.2.1', 'Reembolso de alimentação', 'CREDIT', true, true, (SELECT "id" FROM "Account" WHERE "code" = '3.2'))
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "nature" = EXCLUDED."nature", "analytic" = true, "active" = true, "parentId" = EXCLUDED."parentId";

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
VALUES ('account-food', '4.5', 'Alimentação', 'DEBIT', true, true, (SELECT "id" FROM "Account" WHERE "code" = '4'))
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "nature" = EXCLUDED."nature", "analytic" = true, "active" = true, "parentId" = EXCLUDED."parentId";

-- CreateTable
CREATE TABLE "EntryType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultDebitAccountId" TEXT NOT NULL,
    "defaultCreditAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryType_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AccountingEntry" ADD COLUMN "entryTypeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EntryType_name_key" ON "EntryType"("name");
CREATE INDEX "EntryType_defaultDebitAccountId_idx" ON "EntryType"("defaultDebitAccountId");
CREATE INDEX "EntryType_defaultCreditAccountId_idx" ON "EntryType"("defaultCreditAccountId");
CREATE INDEX "AccountingEntry_entryTypeId_idx" ON "AccountingEntry"("entryTypeId");

-- AddForeignKey
ALTER TABLE "EntryType" ADD CONSTRAINT "EntryType_defaultDebitAccountId_fkey" FOREIGN KEY ("defaultDebitAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EntryType" ADD CONSTRAINT "EntryType_defaultCreditAccountId_fkey" FOREIGN KEY ("defaultCreditAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_entryTypeId_fkey" FOREIGN KEY ("entryTypeId") REFERENCES "EntryType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed initial flexible entry types.
INSERT INTO "EntryType" ("id", "name", "active", "defaultDebitAccountId", "defaultCreditAccountId", "createdAt", "updatedAt") VALUES
    ('entry-type-machine-service', 'Serviço de máquinas', true, (SELECT "id" FROM "Account" WHERE "code" = '1.2'), (SELECT "id" FROM "Account" WHERE "code" = '3.1.1'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('entry-type-food-reimbursement', 'Reembolso de alimentação', true, (SELECT "id" FROM "Account" WHERE "code" = '1.2'), (SELECT "id" FROM "Account" WHERE "code" = '3.2.1'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('entry-type-food-expense', 'Alimentação paga', true, (SELECT "id" FROM "Account" WHERE "code" = '4.5'), (SELECT "id" FROM "Account" WHERE "code" = '1.1'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
