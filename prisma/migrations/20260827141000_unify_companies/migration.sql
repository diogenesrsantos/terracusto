-- Unifica clientes de obras e fornecedores de combustível em um cadastro de empresas.
ALTER TABLE "Supplier" RENAME TO "Company";
ALTER TABLE "Company" RENAME CONSTRAINT "Supplier_pkey" TO "Company_pkey";
ALTER INDEX "Supplier_document_key" RENAME TO "Company_document_key";
ALTER TABLE "Company" RENAME COLUMN "isFuelStation" TO "isFuelSupplier";
ALTER TABLE "Company" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Company" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Company" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Work" ADD COLUMN "companyId" TEXT;

INSERT INTO "Company" ("id", "name", "document", "isFuelSupplier", "active", "createdAt", "updatedAt")
SELECT
  'legacy_' || md5(source.normalized),
  MIN(source.name),
  NULL,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT btrim("client") AS name, lower(btrim("client")) AS normalized
  FROM "Work"
  WHERE btrim("client") <> ''
) AS source
WHERE NOT EXISTS (
  SELECT 1 FROM "Company" company WHERE lower(btrim(company."name")) = source.normalized
)
GROUP BY source.normalized;

UPDATE "Work" work
SET "companyId" = (
  SELECT company."id"
  FROM "Company" company
  WHERE lower(btrim(company."name")) = lower(btrim(work."client"))
  ORDER BY company."isFuelSupplier" DESC, company."id"
  LIMIT 1
)
WHERE btrim(work."client") <> '';

ALTER TABLE "Work" DROP COLUMN "client";
CREATE INDEX "Work_companyId_idx" ON "Work"("companyId");
ALTER TABLE "Work" ADD CONSTRAINT "Work_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "name")
VALUES ('permission_companies_manage', 'companies.manage', 'Gerenciar empresas')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role_row."id", permission_row."id"
FROM "Role" role_row
CROSS JOIN "Permission" permission_row
WHERE role_row."code" IN ('ADMIN', 'CLERK') AND permission_row."code" = 'companies.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
