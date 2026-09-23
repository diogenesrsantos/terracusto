import { PageHead } from "@/components/page";
import { FuelDispenseForm } from "@/components/fuel-dispense-form";
import { FuelDispenseHistory } from "@/components/fuel-dispense-history";
import { db } from "@/lib/db";
import { businessToday, monthStart } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelDispensesPage() {
  await requirePermission("fuel.manage");
  const currentCompetence = monthStart(businessToday());
  const [tanks, fuelTypes, suppliers, works, assets, people, entryTypes, dispenses] = await Promise.all([
    db.fuelTank.findMany({ where: { active: true, fuelType: { active: true } }, include: { fuelType: true, purchases: { select: { liters: true, total: true } }, dispenses: { select: { liters: true, totalCost: true } } }, orderBy: { name: "asc" } }),
    db.fuelType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { active: true, isFuelSupplier: true }, orderBy: { name: "asc" } }),
    db.work.findMany({
      where: { active: true },
      include: { company: true, periods: { where: { status: "OPEN", competence: { lt: currentCompetence } }, orderBy: { competence: "asc" }, take: 1 } },
      orderBy: { code: "asc" },
    }),
    db.asset.findMany({ where: { active: true }, orderBy: { identifier: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.entryType.findMany({ where: { active: true, forFuelDispense: true }, include: { defaultDebitAccount: true, defaultCreditAccount: true }, orderBy: { name: "asc" } }),
    db.fuelDispense.findMany({ include: { fuelType: true, tank: true, supplier: true, asset: true, work: true, person: true, measurement: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return <><PageHead title="Abastecimentos" subtitle="Registre abastecimentos de tanque interno ou diretamente do fornecedor." />
    <section className="card"><h2>Registrar abastecimento</h2><FuelDispenseForm
      tanks={tanks.map((tank) => {
        const liters = tank.purchases.reduce((sum, row) => sum + Number(row.liters), 0) - tank.dispenses.reduce((sum, row) => sum + Number(row.liters), 0);
        const value = tank.purchases.reduce((sum, row) => sum + Number(row.total), 0) - tank.dispenses.reduce((sum, row) => sum + Number(row.totalCost), 0);
        return { id: tank.id, fuelTypeId: tank.fuelTypeId, label: `${tank.name} — ${tank.fuelType.name}`, unitPrice: liters > 0 && value > 0 ? (value / liters).toFixed(4) : "" };
      })}
      fuelTypes={fuelTypes.map((fuelType) => ({ id: fuelType.id, label: fuelType.name }))}
      suppliers={suppliers.map((supplier) => ({ id: supplier.id, label: supplier.name }))}
      works={works.map((work) => ({
        id: work.id,
        label: `${work.code} — ${work.name}`,
        hasClient: Boolean(work.companyId),
        blockedCompetence: work.periods[0]?.competence.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" }) || null,
      }))}
      assets={assets.map((asset) => ({ id: asset.id, label: `${asset.identifier} — ${asset.description} — ${asset.fuelTankCapacity || "?"} L`, enabled: Boolean(asset.fuelTankCapacity && asset.consumptionMetric) }))}
      people={people.map((person) => ({ id: person.id, label: person.name }))}
      entryTypes={entryTypes.map((type) => ({ id: type.id, label: `${type.name} — D: ${type.defaultDebitAccount.code} / C estoque: ${type.defaultCreditAccount.code}` }))}
    /></section>
    <section className="card mt"><h2>Últimos abastecimentos</h2><FuelDispenseHistory dispenses={dispenses} people={people.map((person) => ({ id: person.id, name: person.name }))} /></section>
  </>;
}
