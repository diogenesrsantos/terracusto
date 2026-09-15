import { createFuelPurchase } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelPurchasesPage() {
  await requirePermission("fuel.manage");
  const [fuels, suppliers, works, accounts, purchases] = await Promise.all([
    db.fuelType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { active: true, isFuelSupplier: true }, orderBy: { name: "asc" } }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.fuelPurchase.findMany({ include: { supplier: true, fuelType: true, work: true }, orderBy: { date: "desc" }, take: 100 }),
  ]);
  return <><PageHead title="Compras de combustível" subtitle="Registre entradas no tanque e o custo contábil associado." />
    <section className="card"><h2>Registrar compra</h2><form action={createFuelPurchase} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Cupom/nota<input name="coupon" required /></label>
      <label className="field">Fornecedor<select name="supplierId" required><option value="">Selecione</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Combustível<select name="fuelTypeId" required>{fuels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Preço/litro<input name="unitPrice" type="number" min="0.0001" step="0.0001" required /></label>
      <label className="field span-2">Obra responsável<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Débito<select name="debitAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field span-2">Crédito<select name="creditAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <button className="btn span-4">Registrar compra e custo</button>
    </form></section>
    <section className="card mt"><h2>Últimas compras</h2>{purchases.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor/cupom</th><th>Combustível</th><th>Obra</th><th>Litros</th><th>Total</th></tr></thead><tbody>{purchases.map((p) => <tr key={p.id}><td>{p.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{p.supplier.name}<br /><small>{p.coupon}</small></td><td>{p.fuelType.name}</td><td>{p.work.code}</td><td>{number(p.liters, 3)}</td><td>{money(p.total)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
