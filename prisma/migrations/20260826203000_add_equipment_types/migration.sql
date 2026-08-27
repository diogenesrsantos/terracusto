-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_name_key" ON "EquipmentType"("name");

-- Seed the catalog used by the former enum.
INSERT INTO "EquipmentType" ("id", "name", "active", "createdAt", "updatedAt") VALUES
    ('equipment-type-machine', 'Máquina', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('equipment-type-vehicle', 'Veículo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('equipment-type-tool', 'Ferramenta', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('equipment-type-other', 'Outro', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Preserve the type of every existing asset.
ALTER TABLE "Asset" ADD COLUMN "equipmentTypeId" TEXT;

UPDATE "Asset"
SET "equipmentTypeId" = CASE "kind"::TEXT
    WHEN 'MACHINE' THEN 'equipment-type-machine'
    WHEN 'VEHICLE' THEN 'equipment-type-vehicle'
    WHEN 'TOOL' THEN 'equipment-type-tool'
    ELSE 'equipment-type-other'
END;

ALTER TABLE "Asset" ALTER COLUMN "equipmentTypeId" SET NOT NULL;
ALTER TABLE "Asset" DROP COLUMN "kind";
DROP TYPE "AssetKind";

-- CreateIndex
CREATE INDEX "Asset_equipmentTypeId_idx" ON "Asset"("equipmentTypeId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_equipmentTypeId_fkey"
FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
