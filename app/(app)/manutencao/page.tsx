import Link from "next/link";
import { Prisma } from "@prisma/client";
import { createMaintenance } from "@/app/actions";
import { MaintenanceForm } from "@/components/maintenance-form";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

const labels = { OPEN: "Aberta", IN_PROGRESS: "Em execução", WAITING_PART: "Aguardando peça", DONE: "Fechada", CANCELED: "Cancelada" };
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requirePermission("maintenance.manage");
  const query = await searchParams, filter = query.status || "all";
  const where: Prisma.MaintenanceOrderWhereInput = filter === "open" ? { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_PART"] } } : filter === "closed" ? { status: "DONE" } : filter === "pending" ? { OR: [{ status: { in: ["IN_PROGRESS", "WAITING_PART"] } }, { status: "DONE", resolved: false }] } : {};
  const total = await db.maintenanceOrder.count({ where }), pages = Math.max(1, Math.ceil(total / 20));
  const requested = Number(query.page), page = Number.isFinite(requested) ? Math.min(pages, Math.max(1, Math.floor(requested))) : 1;
  const [orders, assets, works, people] = await Promise.all([
    db.maintenanceOrder.findMany({ where, include: { asset: true, work: true, parts: true, services: true }, orderBy: [{ openedAt: "desc" }, { number: "desc" }], skip: (page - 1) * 20, take: 20 }),
    db.asset.findMany({ where: { active: true }, orderBy: { identifier: "asc" } }), db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }), db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Manutenção" subtitle="Ordens de serviço, peças e serviços de máquinas e veículos." />
    <section className="card"><h2>Abrir ordem de serviço</h2><MaintenanceForm action={createMaintenance}>
      <label className="field">Tipo<select name="kind"><option value="CORRECTIVE">Corretiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label className="field span-2">Equipamento<select name="assetId" required><option value="">Selecione</option>{assets.map(a => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field">Horímetro/odômetro<input name="meter" type="number" min="0" step="0.01" /></label>
      <label className="field">Obra<select name="workId"><option value="">Sem vínculo</option>{works.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field">Responsável<select name="mechanicId"><option value="">A definir</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field span-2">Defeito/solicitação<input name="complaint" required /></label><button className="btn">Abrir ordem</button>
    </MaintenanceForm></section>
    <section className="card mt"><h2>Ordens de serviço</h2><form className="inline-form" method="get"><label>Situação <select name="status" defaultValue={filter}><option value="all">Todas</option><option value="open">Abertas</option><option value="closed">Fechadas</option><option value="pending">Com pendências</option></select></label><button className="btn secondary">Filtrar</button></form>
    {orders.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>OS</th><th>Abertura</th><th>Equipamento / obra</th><th>Situação</th><th>Solicitação</th><th>Total</th><th>Ações</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>#{o.number}</td><td>{o.openedAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{o.asset.identifier}<br />{o.work?.name || "Sem obra"}</td><td>{labels[o.status]}{o.resolved === false && <><br /><span className="badge warn">Problema não resolvido</span></>}</td><td>{o.complaint}</td><td>{money(o.parts.reduce((sum, p) => sum.plus(p.quantity.mul(p.unitCost).toDecimalPlaces(2)), o.externalCost).plus(o.services.reduce((sum, s) => sum.plus(s.value), new Prisma.Decimal(0))))}</td><td><Link className="btn secondary" href={`/manutencao/${o.id}`}>Abrir / gerenciar</Link> <Link href={`/manutencao/${o.id}/relatorio`}>Relatório</Link></td></tr>)}</tbody></table></div>}
    <div className="list-head mt"><span>{total} ordens · Página {page} de {pages}</span><div>{page > 1 && <Link className="btn secondary" href={`?status=${encodeURIComponent(filter)}&page=${page - 1}`}>Anterior</Link>} {page < pages && <Link className="btn secondary" href={`?status=${encodeURIComponent(filter)}&page=${page + 1}`}>Próxima</Link>}</div></div></section>
  </>;
}
