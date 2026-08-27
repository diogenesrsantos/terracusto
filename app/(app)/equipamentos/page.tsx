import { createEquipmentType } from "@/app/actions";
import { AssetsManager } from "@/components/assets-manager";
import { PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const PAGE_SIZE = 20;

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("assets.manage");
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const totalAssets = await db.asset.count();
  const totalPages = Math.max(1, Math.ceil(totalAssets / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const [assets, fuels, equipmentTypes] = await Promise.all([
    db.asset.findMany({ include: { equipmentType: true, fuelType: true }, orderBy: [{ identifier: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.fuelType.findMany({ orderBy: { name: "asc" } }),
    db.equipmentType.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Equipamentos" subtitle="Máquinas, veículos, ferramentas e outros ativos." />
    <section className="card"><h2>Novo tipo de equipamento</h2><form action={createEquipmentType} className="grid grid-2">
      <label className="field">Nome do tipo<input name="name" placeholder="Ex.: Caminhão basculante" required /></label><button className="btn">Cadastrar tipo</button>
    </form></section>
    <AssetsManager key={page} assets={assets.map((asset) => ({
      id: asset.id, equipmentTypeId: asset.equipmentTypeId, equipmentTypeName: asset.equipmentType.name,
      identifier: asset.identifier, description: asset.description, brand: asset.brand, model: asset.model,
      fuelTypeId: asset.fuelTypeId, fuelTypeName: asset.fuelType?.name || null,
      expectedUsage: asset.expectedUsage?.toString() || "", active: asset.active,
    }))} fuels={fuels.map(({ id, name, active }) => ({ id, name, active }))} equipmentTypes={equipmentTypes.map(({ id, name, active }) => ({ id, name, active }))} page={page} totalPages={totalPages} totalAssets={totalAssets} />
  </>;
}
