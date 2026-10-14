INSERT INTO "Account" ("id","code","name","nature","analytic") VALUES ('test-clients','1.2','Clientes','DEBIT',true), ('test-reimbursements','3.2','Despesas reembolsáveis','CREDIT',false);
INSERT INTO "User" ("id","name","email","passwordHash","updatedAt") VALUES ('legacy-user','Teste','legacy@test.local','test',now());
INSERT INTO "EquipmentType" ("id","name","updatedAt") VALUES ('legacy-type','Legado',now());
INSERT INTO "Asset" ("id","equipmentTypeId","identifier","description","updatedAt") VALUES ('legacy-asset','legacy-type','LEGACY','Legado',now());
INSERT INTO "ProductGroup" ("id","name","updatedAt") VALUES ('legacy-group','Legado',now());
INSERT INTO "Product" ("id","name","nameNormalized","unit","groupId","updatedAt") VALUES ('legacy-product','Legado','legado','UN','legacy-group',now());
INSERT INTO "MaintenanceOrder" ("id","kind","status","openedAt","finishedAt","complaint","assetId","createdById","externalCost") VALUES ('legacy-order','CORRECTIVE','DONE','2026-09-01','2026-09-02','Legado','legacy-asset','legacy-user',50);
INSERT INTO "MaintenancePart" ("id","orderId","productId","quantity","unitCost") VALUES ('legacy-part','legacy-order','legacy-product',2,10);
