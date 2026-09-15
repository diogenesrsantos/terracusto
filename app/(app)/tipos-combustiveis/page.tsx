import { Empty, PageHead } from "@/components/page";
import { FuelTypeManager } from "@/components/fuel-type-manager";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function FuelTypesPage() {
  await requirePermission("fuel.manage");
  const fuelTypes = await db.fuelType.findMany({ orderBy: { name: "asc" } });
  return <><PageHead title="Tipos de combustíveis" subtitle="Cadastre os combustíveis utilizados pela frota e pelo tanque." />
    <FuelTypeManager fuelTypes={fuelTypes.map((fuelType) => ({ id: fuelType.id, name: fuelType.name, referencePrice: fuelType.referencePrice?.toString() || null, active: fuelType.active }))} />
  </>;
}
