import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";

export default async function Dashboard() {
  await requirePermission("dashboard.view");
  const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [works, assets, openMaintenance, sums, recent, settings] = await Promise.all([
    db.work.count({ where: { active: true } }), db.asset.count({ where: { active: true } }),
    db.maintenanceOrder.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_PART"] } } }),
    db.accountingLine.aggregate({ where: { entry: { status: "POSTED", date: { gte: start, lt: next } } }, _sum: { debit: true, credit: true } }),
    db.accountingEntry.findMany({ where: { status: "POSTED" }, include: { work: true, lines: true }, orderBy: { date: "desc" }, take: 8 }),
    db.systemSettings.findUnique({ where: { id: "default" }, select: { legalName: true, cnpj: true, address: true, phone: true, responsibleName: true, responsiblePhone: true, reportImageMimeType: true } }),
  ]);
  return <><PageHead title="Visão geral" subtitle="Acompanhe a operação e a movimentação do mês." aside={<aside className="dashboard-company-card" aria-label="Informações da empresa"><div className="dashboard-company-logo">{settings?.reportImageMimeType ? <img src="/api/configuracoes/imagem-relatorio" alt={`Logomarca de ${settings.legalName}`} /> : <span>Sem logo</span>}</div><div><strong>{settings?.legalName || "Empresa não configurada"}</strong>{settings ? <><span>CNPJ: {settings.cnpj}</span><span>{settings.address}</span><span>Telefone: {settings.phone}</span><span>Responsável: {settings.responsibleName} · {settings.responsiblePhone}</span></> : <span>Configure os dados da empresa em Cadastros.</span>}</div></aside>} />
    <section className="grid grid-4">
      <div className="card metric"><span>Obras ativas</span><strong>{works}</strong></div>
      <div className="card metric"><span>Equipamentos</span><strong>{assets}</strong></div>
      <div className="card metric"><span>Débitos no mês</span><strong>{money(sums._sum.debit)}</strong></div>
      <div className="card metric"><span>Manutenções abertas</span><strong>{openMaintenance}</strong></div>
    </section>
    <section className="card mt"><h2>Últimos lançamentos</h2><div className="table-wrap"><table><thead><tr><th>Data</th><th>Obra</th><th>Histórico</th><th className="text-right">Valor</th></tr></thead>
      <tbody>{recent.map((entry) => <tr key={entry.id}><td>{entry.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{entry.work.code}</td><td>{entry.history}</td><td className="text-right">{money(entry.lines.reduce((sum, line) => sum + Number(line.debit), 0))}</td></tr>)}</tbody>
    </table></div></section>
  </>;
}
