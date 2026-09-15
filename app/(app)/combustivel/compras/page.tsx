import { createFuelPurchase, createSupplierPayment } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelPurchasesPage() {
  await requirePermission("fuel.manage");
  const [tanks, suppliers, works, accounts, purchases, supplierLedger, ledgerBalances] = await Promise.all([
    db.fuelTank.findMany({ where: { active: true, fuelType: { active: true } }, include: { fuelType: true }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { active: true, isFuelSupplier: true }, orderBy: { name: "asc" } }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.fuelPurchase.findMany({ include: { supplier: true, fuelType: true, tank: true, work: true }, orderBy: { date: "desc" }, take: 100 }),
    db.supplierLedgerEntry.findMany({ include: { supplier: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    db.supplierLedgerEntry.groupBy({ by: ["supplierId"], _sum: { debit: true, credit: true } }),
  ]);
  const supplierBalances = suppliers.map((supplier) => { const total = ledgerBalances.find((row) => row.supplierId === supplier.id)?._sum; return { ...supplier, balance: Number(total?.credit || 0) - Number(total?.debit || 0) }; }).filter((supplier) => supplier.balance > 0);
  return <><PageHead title="Compras de combustível" subtitle="Registre entradas no tanque e o custo contábil associado." />
    <section className="card"><h2>Registrar compra</h2><form action={createFuelPurchase} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Cupom/nota<input name="coupon" required /></label>
      <label className="field">Fornecedor<select name="supplierId" required><option value="">Selecione</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field">Tanque/combustível<select name="tankId" required><option value="">Selecione</option>{tanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.name} — {tank.fuelType.name}</option>)}</select></label>
      <label className="field">Pagamento<select name="paymentTerm"><option value="CASH">À vista</option><option value="CREDIT">A prazo</option></select></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Preço/litro<input name="unitPrice" type="number" min="0.0001" step="0.0001" required /></label>
      <label className="field span-2">Obra responsável<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Débito<select name="debitAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field span-2">Crédito<select name="creditAccountId" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <button className="btn span-4">Registrar compra e custo</button>
    </form></section>
    <section className="card mt"><h2>Registrar pagamento ao fornecedor</h2><form action={createSupplierPayment} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field span-2">Fornecedor<select name="supplierId" required><option value="">Selecione</option>{supplierBalances.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} — saldo {money(supplier.balance)}</option>)}</select></label>
      <label className="field">Valor<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field">Documento<input name="document" /></label>
      <label className="field span-2">Centro de custos<select name="workId" required><option value="">Selecione</option>{works.map((work) => <option key={work.id} value={work.id}>{work.code} — {work.name}</option>)}</select></label>
      <label className="field span-2">Débito (fornecedor)<select name="debitAccountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
      <label className="field span-2">Crédito (caixa/banco)<select name="creditAccountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
      <button className="btn span-4">Registrar pagamento</button>
    </form></section>
    <section className="card mt"><h2>Últimas compras</h2>{purchases.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor/nota</th><th>Tanque</th><th>Obra</th><th>Pagamento</th><th>Litros</th><th>Total</th></tr></thead><tbody>{purchases.map((p) => <tr key={p.id}><td>{p.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{p.supplier.name}<br /><small>{p.coupon}</small></td><td>{p.tank.name}<br /><small>{p.fuelType.name}</small></td><td>{p.work.code}</td><td>{p.paymentTerm === "CREDIT" ? "A prazo" : "À vista"}</td><td>{number(p.liters, 3)}</td><td>{money(p.total)}</td></tr>)}</tbody></table></div>}</section>
    <section className="card mt"><h2>Conta corrente de fornecedores</h2>{supplierLedger.length === 0 ? <Empty>Nenhuma compra a prazo registrada.</Empty> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor</th><th>Documento</th><th>Histórico</th><th className="text-right">Débito</th><th className="text-right">Crédito</th></tr></thead><tbody>{supplierLedger.map((row) => <tr key={row.id}><td>{row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{row.supplier.name}</td><td>{row.document || "—"}</td><td>{row.description}</td><td className="text-right">{money(row.debit)}</td><td className="text-right">{money(row.credit)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
