import { createFuelDispense, createFuelPurchase, createSupplier } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelPage() {
  await requirePermission("fuel.manage");
  const [fuels, suppliers, works, assets, people, accounts, purchases, dispenses] = await Promise.all([
    db.fuelType.findMany({ orderBy: { name: "asc" } }), db.supplier.findMany({ where: { active: true, isFuelStation: true }, orderBy: { name: "asc" } }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }), db.asset.findMany({ where: { active: true, fuelTypeId: { not: null } }, orderBy: { identifier: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }), db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.fuelPurchase.findMany({ include: { supplier: true, fuelType: true, work: true }, orderBy: { date: "desc" }, take: 50 }),
    db.fuelDispense.findMany({ include: { fuelType: true, asset: true, work: true, person: true }, orderBy: { date: "desc" }, take: 50 }),
  ]);
  const balances = await Promise.all(fuels.map(async (fuel) => {
    const [input, output] = await Promise.all([db.fuelPurchase.aggregate({ where: { fuelTypeId: fuel.id }, _sum: { liters: true } }), db.fuelDispense.aggregate({ where: { fuelTypeId: fuel.id }, _sum: { liters: true } })]);
    return { ...fuel, balance: Number(input._sum.liters || 0) - Number(output._sum.liters || 0) };
  }));
  return <><PageHead title="Combustível" subtitle="Compras, tanque próprio, abastecimentos e consumo da frota." />
    <section className="grid grid-4">{balances.map((b) => <div className="card metric" key={b.id}><span>Saldo · {b.name}</span><strong>{number(b.balance, 3)} L</strong></div>)}</section>
    <section className="grid grid-2 mt"><div className="card"><h2>Novo posto</h2><form action={createSupplier} className="grid grid-2">
      <label className="field">Nome<input name="name" required /></label><label className="field">CNPJ/CPF<input name="document" /></label><button className="btn">Cadastrar posto</button>
    </form></div>
    <div className="card"><h2>Registrar compra</h2><form action={createFuelPurchase} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Cupom/nota<input name="coupon" required /></label>
      <label className="field">Posto<select name="supplierId" required><option value="">Selecione</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Combustível<select name="fuelTypeId" required>{fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Preço/litro<input name="unitPrice" type="number" min="0.0001" step="0.0001" required /></label>
      <label className="field span-2">Obra responsável<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Débito (combustível/estoque)<select name="debitAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field span-2">Crédito (fornecedor/caixa)<select name="creditAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <button className="btn span-4">Registrar compra e custo</button>
    </form></div></section>
    <section className="card mt"><h2>Registrar abastecimento</h2><form action={createFuelDispense} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Combustível<select name="fuelTypeId" required>{fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Horímetro/odômetro<input name="meter" type="number" step="0.01" /></label>
      <label className="field span-2">Equipamento<select name="assetId" required><option value="">Selecione</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field span-2">Obra<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Motorista/operador<select name="personId"><option value="">Opcional</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Observação<input name="notes" /></label><button className="btn">Dar saída do tanque</button>
    </form></section>
    <section className="grid grid-2 mt"><div className="card"><h2>Últimas compras</h2>{purchases.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Posto/cupom</th><th>Obra</th><th>Litros</th><th>Total</th></tr></thead><tbody>{purchases.map((p) => <tr key={p.id}><td>{p.date.toLocaleDateString("pt-BR", {timeZone:"UTC"})}</td><td>{p.supplier.name}<br /><small>{p.coupon}</small></td><td>{p.work.code}</td><td>{number(p.liters, 3)}</td><td>{money(p.total)}</td></tr>)}</tbody></table></div>}</div>
      <div className="card"><h2>Últimos abastecimentos</h2>{dispenses.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Equipamento</th><th>Obra</th><th>Litros</th><th>Operador</th></tr></thead><tbody>{dispenses.map((d) => <tr key={d.id}><td>{d.date.toLocaleDateString("pt-BR", {timeZone:"UTC"})}</td><td>{d.asset.identifier}</td><td>{d.work.code}</td><td>{number(d.liters, 3)}</td><td>{d.person?.name || "—"}</td></tr>)}</tbody></table></div>}</div>
    </section>
  </>;
}
