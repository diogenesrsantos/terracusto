import { Empty, PageHead } from "@/components/page";
import { FuelDispenseForm } from "@/components/fuel-dispense-form";
import { db } from "@/lib/db";
import { businessToday, money, monthStart, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelDispensesPage() {
  await requirePermission("fuel.manage");
  const currentCompetence = monthStart(businessToday());
  const [tanks, fuelTypes, suppliers, works, assets, people, entryTypes, dispenses] = await Promise.all([
    db.fuelTank.findMany({ where: { active: true, fuelType: { active: true } }, include: { fuelType: true }, orderBy: { name: "asc" } }),
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
      tanks={tanks.map((tank) => ({ id: tank.id, fuelTypeId: tank.fuelTypeId, label: `${tank.name} — ${tank.fuelType.name}` }))}
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
    <section className="card mt"><h2>Últimos abastecimentos</h2>{dispenses.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Origem</th><th>Equipamento</th><th>Obra</th><th>Litros</th><th>Medidor</th><th>Média</th><th>Custo</th><th>Medição</th></tr></thead><tbody>{dispenses.map((d) => <tr key={d.id}><td>{d.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{d.source === "DIRECT_SUPPLIER" ? d.supplier?.name || "Fornecedor" : d.tank?.name || "Tanque"}<br /><small>{d.fuelType.name}{d.document ? ` · ${d.document}` : ""}</small></td><td>{d.asset.identifier}<br /><small>{d.person?.name || "Sem operador"}</small></td><td>{d.work.code}</td><td>{number(d.liters, 3)}</td><td>{d.meter ? number(d.meter, 2) : "—"}</td><td>{d.consumptionRate ? `${number(d.consumptionRate, 3)} ${d.asset.consumptionMetric === "LITERS_PER_HOUR" ? "L/h" : "km/L"}` : "Primeira referência"}</td><td>{money(d.totalCost)}</td><td>{!d.reimbursable ? "Não reembolsável" : d.measurement ? `Medição ${d.measurement.number}` : "Pendente"}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
