import { createFuelDispense } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelDispensesPage() {
  await requirePermission("fuel.manage");
  const [tanks, works, assets, people, entryTypes, dispenses] = await Promise.all([
    db.fuelTank.findMany({ where: { active: true, fuelType: { active: true } }, include: { fuelType: true }, orderBy: { name: "asc" } }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.asset.findMany({ where: { active: true, fuelType: { active: true } }, orderBy: { identifier: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.entryType.findMany({ where: { active: true, forFuelDispense: true }, include: { defaultDebitAccount: true, defaultCreditAccount: true }, orderBy: { name: "asc" } }),
    db.fuelDispense.findMany({ include: { fuelType: true, tank: true, asset: true, work: true, person: true }, orderBy: { date: "desc" }, take: 100 }),
  ]);
  return <><PageHead title="Abastecimentos" subtitle="Registre a saída do tanque para equipamentos e obras." />
    <section className="card"><h2>Registrar abastecimento</h2><form action={createFuelDispense} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Tanque/combustível<select name="tankId" required><option value="">Selecione</option>{tanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.name} — {tank.fuelType.name}</option>)}</select></label>
      <label className="field">Litros para completar<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Horímetro/odômetro atual<input name="meter" type="number" min="0" step="0.01" required /></label>
      <label className="field span-2">Equipamento/placa<select name="assetId" required><option value="">Selecione</option>{assets.map((a) => <option key={a.id} value={a.id} disabled={!a.fuelTankCapacity || !a.consumptionMetric}>{a.identifier} — {a.description}{!a.fuelTankCapacity || !a.consumptionMetric ? " — configure tanque/consumo" : ` — ${a.fuelTankCapacity} L`}</option>)}</select></label>
      <label className="field span-2">Obra<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Tipo de lançamento<select name="entryTypeId" required><option value="">Selecione</option>{entryTypes.map((type) => <option key={type.id} value={type.id}>{type.name} — D: {type.defaultDebitAccount.code} / C: {type.defaultCreditAccount.code}</option>)}</select></label>
      <label className="field span-2">Motorista/operador<select name="personId"><option value="">Opcional</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Observação<input name="notes" /></label><button className="btn">Registrar tanque cheio e contabilizar</button>
    </form></section>
    <section className="card mt"><h2>Últimos abastecimentos</h2>{dispenses.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tanque</th><th>Equipamento</th><th>Obra</th><th>Litros</th><th>Medidor</th><th>Média</th><th>Custo</th><th>Operador</th></tr></thead><tbody>{dispenses.map((d) => <tr key={d.id}><td>{d.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{d.tank.name}<br /><small>{d.fuelType.name}</small></td><td>{d.asset.identifier}</td><td>{d.work.code}</td><td>{number(d.liters, 3)}</td><td>{d.meter ? number(d.meter, 2) : "—"}</td><td>{d.consumptionRate ? `${number(d.consumptionRate, 3)} ${d.asset.consumptionMetric === "LITERS_PER_HOUR" ? "L/h" : "km/L"}` : "Primeira referência"}</td><td>{money(d.totalCost)}</td><td>{d.person?.name || "—"}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
