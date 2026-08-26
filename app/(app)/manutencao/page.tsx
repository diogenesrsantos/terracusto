import { createMaintenance, finishMaintenance } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

const status = { OPEN: "Aberta", IN_PROGRESS: "Em execução", WAITING_PART: "Aguardando peça", DONE: "Concluída", CANCELED: "Cancelada" };
export default async function MaintenancePage() {
  await requirePermission("maintenance.manage");
  const [orders, assets, works, people] = await Promise.all([
    db.maintenanceOrder.findMany({ include: { asset: true, work: true, mechanic: true }, orderBy: { openedAt: "desc" }, take: 100 }),
    db.asset.findMany({ where: { active: true }, orderBy: { identifier: "asc" } }), db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Manutenção" subtitle="Ordens preventivas e corretivas de máquinas e veículos." />
    <section className="card"><h2>Abrir ordem de serviço</h2><form action={createMaintenance} className="form-grid">
      <label className="field">Tipo<select name="kind"><option value="CORRECTIVE">Corretiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label className="field span-2">Equipamento<select name="assetId" required><option value="">Selecione</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field">Horímetro/odômetro<input name="meter" type="number" step="0.01" /></label>
      <label className="field span-2">Obra<select name="workId"><option value="">Sem vínculo</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field">Mecânico<select name="mechanicId"><option value="">A definir</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Defeito/solicitação<input name="complaint" required /></label><button className="btn span-4">Abrir ordem</button>
    </form></section>
    <section className="card mt"><h2>Ordens de serviço</h2>{orders.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>OS</th><th>Abertura</th><th>Equipamento</th><th>Tipo/status</th><th>Solicitação</th><th>Responsável</th><th>Custo externo</th><th>Conclusão</th></tr></thead><tbody>
      {orders.map((o) => <tr key={o.id}><td><strong>#{o.number}</strong></td><td>{o.openedAt.toLocaleDateString("pt-BR")}</td><td>{o.asset.identifier}<br /><small>{o.asset.description}</small></td><td>{o.kind === "PREVENTIVE" ? "Preventiva" : "Corretiva"}<br /><span className={`badge ${o.status === "DONE" ? "" : "warn"}`}>{status[o.status]}</span></td><td>{o.complaint}{o.diagnosis && <><br /><small>Diagnóstico: {o.diagnosis}</small></>}</td><td>{o.mechanic?.name || "—"}</td><td>{money(o.externalCost)}</td><td>{o.status !== "DONE" ? <form action={finishMaintenance} className="grid"><input type="hidden" name="id" value={o.id} /><input name="diagnosis" placeholder="Diagnóstico" required /><input name="service" placeholder="Serviço executado" required /><input name="externalCost" type="number" step="0.01" defaultValue="0" /><button className="btn">Concluir</button></form> : o.finishedAt?.toLocaleDateString("pt-BR")}</td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
