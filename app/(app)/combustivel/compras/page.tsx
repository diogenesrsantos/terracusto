import { createFuelPurchase, createSupplierPayment } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function FuelPurchasesPage() {
  await requirePermission("fuel.manage");
  const [tanks, suppliers, purchases, supplierLedger, payableRows] = await Promise.all([
    db.fuelTank.findMany({ where: { active: true, fuelType: { active: true } }, include: { fuelType: true }, orderBy: { name: "asc" } }),
    db.company.findMany({ where: { active: true, isFuelSupplier: true }, orderBy: { name: "asc" } }),
    db.fuelPurchase.findMany({ include: { supplier: true, fuelType: true, tank: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    db.supplierLedgerEntry.findMany({ include: { supplier: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    db.supplierLedgerEntry.findMany({ where: { credit: { gt: 0 } }, include: { payableAllocations: { select: { amount: true } } } }),
  ]);
  const supplierBalances = suppliers.map((supplier) => ({
    ...supplier,
    balance: payableRows.filter((row) => row.supplierId === supplier.id).reduce((sum, row) => sum + Number(row.credit) - row.payableAllocations.reduce((paid, allocation) => paid + Number(allocation.amount), 0), 0),
  })).filter((supplier) => supplier.balance > 0.005);

  return <><PageHead title="Compras de combustível" subtitle="Registre entradas nos tanques e pague fornecedores por ordem de vencimento." />
    <section className="card"><h2>Registrar compra para tanque interno</h2><form action={createFuelPurchase} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Cupom/nota<input name="coupon" required /></label>
      <label className="field">Fornecedor<select name="supplierId" required><option value="">Selecione</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <label className="field">Tanque/combustível<select name="tankId" required><option value="">Selecione</option>{tanks.map((tank) => <option key={tank.id} value={tank.id}>{tank.name} — {tank.fuelType.name}</option>)}</select></label>
      <label className="field">Pagamento<select name="paymentTerm"><option value="CASH">À vista</option><option value="CREDIT">A prazo</option></select></label>
      <label className="field">Vencimento (se a prazo)<input name="dueDate" type="date" /></label>
      <label className="field">Litros<input name="liters" type="number" min="0.001" step="0.001" required /></label><label className="field">Preço/litro<input name="unitPrice" type="number" min="0.0001" step="0.0001" required /></label>
      <p className="muted span-4">Contabilização automática: Estoque de combustível × Fornecedores ou Caixa/Banco.</p>
      <button className="btn span-4">Registrar compra para o tanque</button>
    </form></section>
    <section className="card mt"><h2>Registrar pagamento ao fornecedor</h2><form action={createSupplierPayment} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field span-2">Fornecedor<select name="supplierId" required><option value="">Selecione</option>{supplierBalances.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} — saldo {money(supplier.balance)}</option>)}</select></label>
      <label className="field">Valor<input name="amount" type="number" min="0.01" step="0.01" required /></label><label className="field">Documento<input name="document" /></label>
      <p className="muted span-4">O pagamento será distribuído automaticamente entre os títulos mais antigos por vencimento.</p>
      <button className="btn span-4">Registrar pagamento</button>
    </form></section>
    <section className="card mt"><h2>Últimas compras para tanques</h2>{purchases.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor/nota</th><th>Tanque</th><th>Pagamento</th><th>Litros</th><th>Total</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td>{purchase.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{purchase.supplier.name}<br /><small>{purchase.coupon}</small></td><td>{purchase.tank.name}<br /><small>{purchase.fuelType.name}</small></td><td>{purchase.paymentTerm === "CREDIT" ? "A prazo" : "À vista"}</td><td>{number(purchase.liters, 3)}</td><td>{money(purchase.total)}</td></tr>)}</tbody></table></div>}</section>
    <section className="card mt"><h2>Movimentação recente de fornecedores</h2>{supplierLedger.length === 0 ? <Empty>Nenhuma compra a prazo registrada.</Empty> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Fornecedor</th><th>Documento</th><th>Histórico</th><th className="text-right">Pagamento</th><th className="text-right">Dívida</th></tr></thead><tbody>{supplierLedger.map((row) => <tr key={row.id}><td>{row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{row.supplier.name}</td><td>{row.document || "—"}</td><td>{row.description}</td><td className="text-right">{Number(row.debit) ? money(row.debit) : "—"}</td><td className="text-right">{Number(row.credit) ? money(row.credit) : "—"}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
