import { createFuelDispense } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelDispensesPage() {
  await requirePermission("fuel.manage");
  const [fuels, works, assets, people, dispenses] = await Promise.all([
    db.fuelType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.asset.findMany({ where: { active: true, fuelType: { active: true } }, orderBy: { identifier: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.fuelDispense.findMany({ include: { fuelType: true, asset: true, work: true, person: true }, orderBy: { date: "desc" }, take: 100 }),
  ]);
  return <><PageHead title="Abastecimentos" subtitle="Registre a saída do tanque para equipamentos e obras." />
    <section className="card"><h2>Registrar abastecimento</h2><form action={createFuelDispense} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Combustível<select name="fuelTypeId" required>{fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Horímetro/odômetro<input name="meter" type="number" step="0.01" /></label>
      <label className="field span-2">Equipamento<select name="assetId" required><option value="">Selecione</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field span-2">Obra<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Motorista/operador<select name="personId"><option value="">Opcional</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Observação<input name="notes" /></label><button className="btn">Dar saída do tanque</button>
    </form></section>
    <section className="card mt"><h2>Últimos abastecimentos</h2>{dispenses.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Combustível</th><th>Equipamento</th><th>Obra</th><th>Litros</th><th>Operador</th></tr></thead><tbody>{dispenses.map((d) => <tr key={d.id}><td>{d.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{d.fuelType.name}</td><td>{d.asset.identifier}</td><td>{d.work.code}</td><td>{number(d.liters, 3)}</td><td>{d.person?.name || "—"}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
