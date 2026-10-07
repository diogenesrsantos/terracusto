CREATE TYPE "StockIssueStatus" AS ENUM ('DRAFT', 'CHECKED', 'POSTED', 'CANCELED');

CREATE TABLE "ProductGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductGroup_name_key" ON "ProductGroup"("name");
INSERT INTO "ProductGroup" ("id", "name") VALUES ('stock-legacy-group', 'Sem grupo') ON CONFLICT ("id") DO NOTHING;

CREATE SEQUENCE "Product_number_seq";
ALTER TABLE "Product" ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('"Product_number_seq"');
ALTER SEQUENCE "Product_number_seq" OWNED BY "Product"."number";
ALTER TABLE "Product" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Product" ADD COLUMN "nameNormalized" TEXT;
ALTER TABLE "Product" ADD COLUMN "currentUnitCost" DECIMAL(14,4);
ALTER TABLE "Product" ADD COLUMN "requiresExpiry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Product" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH ranked AS (
  SELECT "id", lower(trim("name")) AS normalized,
    row_number() OVER (PARTITION BY lower(trim("name")) ORDER BY "id") AS position
  FROM "Product"
)
UPDATE "Product" product
SET "nameNormalized" = ranked.normalized || CASE WHEN ranked.position > 1 THEN ' (legado ' || ranked.position || ')' ELSE '' END,
    "groupId" = 'stock-legacy-group'
FROM ranked WHERE ranked."id" = product."id";

ALTER TABLE "Product" ALTER COLUMN "nameNormalized" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "groupId" SET NOT NULL;
CREATE UNIQUE INDEX "Product_number_key" ON "Product"("number");
CREATE UNIQUE INDEX "Product_nameNormalized_key" ON "Product"("nameNormalized");
CREATE INDEX "Product_groupId_active_idx" ON "Product"("groupId", "active");
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD COLUMN "expirationDate" TIMESTAMP(3);
ALTER TABLE "StockMovement" ADD COLUMN "operationId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "issueItemId" TEXT;
CREATE UNIQUE INDEX "StockMovement_issueItemId_key" ON "StockMovement"("issueItemId");
CREATE INDEX "StockMovement_operationId_idx" ON "StockMovement"("operationId");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "StockIssue_number_seq";
CREATE TABLE "StockIssue" (
  "id" TEXT NOT NULL,
  "number" INTEGER NOT NULL DEFAULT nextval('"StockIssue_number_seq"'),
  "operationId" TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  "date" TIMESTAMP(3) NOT NULL,
  "status" "StockIssueStatus" NOT NULL DEFAULT 'DRAFT',
  "workId" TEXT,
  "debitAccountId" TEXT,
  "entryId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockIssue_pkey" PRIMARY KEY ("id")
);
ALTER SEQUENCE "StockIssue_number_seq" OWNED BY "StockIssue"."number";
CREATE UNIQUE INDEX "StockIssue_number_key" ON "StockIssue"("number");
CREATE UNIQUE INDEX "StockIssue_operationId_key" ON "StockIssue"("operationId");
CREATE UNIQUE INDEX "StockIssue_entryId_key" ON "StockIssue"("entryId");
CREATE INDEX "StockIssue_createdById_status_idx" ON "StockIssue"("createdById", "status");
CREATE INDEX "StockIssue_workId_date_idx" ON "StockIssue"("workId", "date");

CREATE TABLE "StockIssueItem" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(14,3) NOT NULL,
  "unitCost" DECIMAL(14,4) NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockIssueItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockIssueItem_issueId_productId_key" ON "StockIssueItem"("issueId", "productId");
CREATE INDEX "StockIssueItem_productId_idx" ON "StockIssueItem"("productId");

ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "AccountingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockIssue" ADD CONSTRAINT "StockIssue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockIssueItem" ADD CONSTRAINT "StockIssueItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "StockIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockIssueItem" ADD CONSTRAINT "StockIssueItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_issueItemId_fkey" FOREIGN KEY ("issueItemId") REFERENCES "StockIssueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Account" ("id", "code", "name", "nature", "analytic", "active", "parentId")
SELECT 'materials-stock-account', '1.4', 'Estoque de materiais', 'DEBIT', true, true, parent."id"
FROM "Account" parent WHERE parent."code" = '1'
  AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "code" = '1.4');
