import { Empty, PageHead } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { ReportHeader } from "@/components/report-header";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessToday, date, dateInput, money } from "@/lib/format";

type SearchParams = { mode?: string; supplierId?: string; asOf?: string };

export default async function SupplierReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("fuel.manage");
  const params = await searchParams;
  const mode = params.mode === "detail" ? "detail" : "summary";
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(params.asOf || "") ? new Date(`${params.asOf}T23:59:59.999Z`) : businessToday();
  const suppliers = await db.company.findMany({ where: { isFuelSupplier: true }, orderBy: { name: "asc" } });
  const selectedSupplier = suppliers.find((supplier) => supplier.id === params.supplierId);
  const payables = await db.supplierLedgerEntry.findMany({
    where: { credit: { gt: 0 }, date: { lte: asOf }, ...(mode === "detail" && selectedSupplier ? { supplierId: selectedSupplier.id } : {}) },
    include: {
      supplier: true, purchase: { include: { tank: true } }, dispense: { include: { asset: true, work: true } },
      payableAllocations: { include: { payment: { select: { date: true } } } },
    }, orderBy: [{ supplierId: "asc" }, { dueDate: "asc" }, { date: "asc" }],
  });
  const rows = payables.map((payable) => {
    const paid = payable.payableAllocations.filter((allocation) => allocation.payment.date <= asOf).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const balance = Number(payable.credit) - paid;
    return { payable, paid, balance, overdue: balance > 0.005 && Boolean(payable.dueDate && payable.dueDate < asOf) };
  });
  const summaries = suppliers.map((supplier) => {
    const supplierRows = rows.filter((row) => row.payable.supplierId === supplier.id);
    return { supplier, purchases: supplierRows.reduce((sum, row) => sum + Number(row.payable.credit), 0), paid: supplierRows.reduce((sum, row) => sum + row.paid, 0), balance: supplierRows.reduce((sum, row) => sum + row.balance, 0), overdue: supplierRows.filter((row) => row.overdue).reduce((sum, row) => sum + row.balance, 0) };
  }).filter((summary) => summary.purchases > 0);
  const totals = summaries.reduce((total, summary) => ({ purchases: total.purchases + summary.purchases, paid: total.paid + summary.paid, balance: total.balance + summary.balance, overdue: total.overdue + summary.overdue }), { purchases: 0, paid: 0, balance: 0, overdue: 0 });

  return <>
    <div className="no-print"><PageHead title="Fornecedores de combustível" subtitle="Consulte dívidas, pagamentos e títulos por empresa." /></div>
    <section className="card no-print"><form method="get" className="form-grid">
      <label className="field">Relatório<select name="mode" defaultValue={mode}><option value="summary">Resumo de fornecedores</option><option value="detail">Detalhado por empresa</option></select></label>
      <label className="field span-2">Fornecedor<select name="supplierId" defaultValue={selectedSupplier?.id || ""}><option value="">{mode === "detail" ? "Selecione" : "Todas as empresas"}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <label className="field">Posição em<input name="asOf" type="date" defaultValue={dateInput(asOf)} required /></label>
      <div className="form-actions"><button className="btn">Gerar relatório</button></div>
    </form></section>
    {(mode === "summary" || selectedSupplier) && <section className="report-sheet"><div className="report-actions no-print"><PrintButton /></div><ReportHeader title="Contas a pagar — combustível" />
      <div className="report-meta"><strong>Posição:</strong> {date(asOf)}<br /><strong>Escopo:</strong> {mode === "summary" ? "Todos os fornecedores" : selectedSupplier?.name}</div>
      {mode === "summary" ? <><h2>Resumo por fornecedor</h2>{summaries.length === 0 ? <Empty>Nenhum título encontrado.</Empty> : <div className="table-wrap"><table><thead><tr><th>Fornecedor</th><th className="text-right">Compras a prazo</th><th className="text-right">Pago</th><th className="text-right">Vencido</th><th className="text-right">Saldo aberto</th></tr></thead><tbody>{summaries.map((summary) => <tr key={summary.supplier.id}><td>{summary.supplier.name}</td><td className="text-right">{money(summary.purchases)}</td><td className="text-right">{money(summary.paid)}</td><td className="text-right">{money(summary.overdue)}</td><td className="text-right"><strong>{money(summary.balance)}</strong></td></tr>)}</tbody><tfoot><tr><th>Total geral</th><th className="text-right">{money(totals.purchases)}</th><th className="text-right">{money(totals.paid)}</th><th className="text-right">{money(totals.overdue)}</th><th className="text-right">{money(totals.balance)}</th></tr></tfoot></table></div>}</> : <><h2>Títulos detalhados</h2>{rows.length === 0 ? <Empty>Nenhum título encontrado para este fornecedor.</Empty> : <div className="table-wrap"><table><thead><tr><th>Emissão</th><th>Vencimento</th><th>Documento/origem</th><th>Equipamento/obra</th><th>Situação</th><th className="text-right">Valor</th><th className="text-right">Pago</th><th className="text-right">Saldo</th></tr></thead><tbody>{rows.map(({ payable, paid, balance, overdue }) => <tr key={payable.id}><td>{date(payable.date)}</td><td>{payable.dueDate ? date(payable.dueDate) : "—"}</td><td>{payable.document || "—"}<br /><small>{payable.purchase ? `Tanque ${payable.purchase.tank.name}` : "Abastecimento direto"}</small></td><td>{payable.dispense ? <>{payable.dispense.asset.identifier}<br /><small>Obra {payable.dispense.work.code}</small></> : "—"}</td><td>{balance <= 0.005 ? "Pago" : paid > 0 ? "Parcial" : overdue ? "Vencido" : "Em aberto"}</td><td className="text-right">{money(payable.credit)}</td><td className="text-right">{money(paid)}</td><td className="text-right"><strong>{money(balance)}</strong></td></tr>)}</tbody></table></div>}</>}
      <p className="report-footer">Emitido em {date(new Date())}</p>
    </section>}
  </>;
}
