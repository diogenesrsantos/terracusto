import Link from "next/link";
import { notFound } from "next/navigation";
import { addMaintenancePart, addMaintenanceService, deleteMaintenance, finishMaintenance, removeMaintenancePart, removeMaintenanceService, updateMaintenance } from "@/app/maintenance-actions";
import { MaintenanceForm, MaintenancePartFields } from "@/components/maintenance-form";
import { MaintenanceSummary } from "@/components/maintenance-summary";
import { PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { businessToday } from "@/lib/format";

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("maintenance.manage"); const { id } = await params;
  const o = await db.maintenanceOrder.findUnique({ where: { id }, include: { asset: true, work: true, mechanic: true, parts: { include: { product: true }, orderBy: { date: "asc" } }, services: { include: { employee: true }, orderBy: { date: "asc" } } } });
  if (!o) notFound();
  const editable = !["DONE", "CANCELED"].includes(o.status), today = businessToday().toISOString().slice(0, 10);
  const [assets, works, people, products] = editable ? await Promise.all([
    db.asset.findMany({ where: { OR: [{ active: true }, { id: o.assetId }] }, orderBy: { identifier: "asc" } }), db.work.findMany({ where: { OR: [{ active: true }, { id: o.workId || "" }] }, orderBy: { code: "asc" } }), db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }), db.product.findMany({ where: { active: true }, orderBy: { number: "asc" } }),
  ]) : [[], [], [], []];
  const hidden = <input type="hidden" name="id" value={id} />;
  return <><PageHead title={`Ordem de serviço nº ${o.number}`} subtitle={o.complaint} aside={<div><Link className="btn secondary" href="/manutencao">Voltar</Link> <Link className="btn" href={`/manutencao/${id}/relatorio`}>Relatório</Link></div>} />
    {editable && <section className="card"><h2>Editar ordem de serviço</h2><MaintenanceForm action={updateMaintenance}>{hidden}
      <label className="field">Tipo<select name="kind" defaultValue={o.kind}><option value="CORRECTIVE">Corretiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label className="field">Situação<select name="status" defaultValue={o.status}><option value="OPEN">Aberta</option><option value="IN_PROGRESS">Em execução</option><option value="WAITING_PART">Aguardando peça</option></select></label>
      <label className="field span-2">Equipamento<select name="assetId" defaultValue={o.assetId} required>{assets.map(a => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field">Obra<select name="workId" defaultValue={o.workId || ""}><option value="">Sem vínculo</option>{works.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field">Responsável<select name="mechanicId" defaultValue={o.mechanicId || ""}><option value="">A definir</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Horímetro/odômetro<input name="meter" type="number" min="0" step="0.01" defaultValue={o.meter?.toString() || ""} /></label>
      <label className="field span-2">Defeito/solicitação<input name="complaint" defaultValue={o.complaint} required /></label><button className="btn">Salvar alterações</button>
    </MaintenanceForm></section>}
    <MaintenanceSummary order={o} partAction={editable ? partId => <MaintenanceForm action={removeMaintenancePart} confirmMessage="Remover esta peça? A baixa vinculada será desfeita e o saldo retornará ao estoque.">{hidden}<input type="hidden" name="partId" value={partId} /><button className="btn secondary">Remover</button></MaintenanceForm> : undefined} serviceAction={editable ? serviceId => <MaintenanceForm action={removeMaintenanceService} confirmMessage="Remover este serviço da ordem?">{hidden}<input type="hidden" name="serviceId" value={serviceId} /><button className="btn secondary">Remover</button></MaintenanceForm> : undefined} />
    {editable && <>
      <section className="card mt"><h2>Adicionar peça</h2><p>Peças do almoxarifado dão baixa imediatamente. Peças de fornecedor exigem nota fiscal.</p><MaintenanceForm action={addMaintenancePart}>{hidden}<MaintenancePartFields products={products.map(p => ({ id: p.id, number: p.number, name: p.name, cost: p.currentUnitCost?.toString() || "" }))} today={today} /></MaintenanceForm></section>
      <section className="card mt"><h2>Adicionar serviço</h2><MaintenanceForm action={addMaintenanceService}>{hidden}<label className="field">Data do serviço<input name="date" type="date" defaultValue={today} max={today} required /></label><label className="field span-2">Descrição<input name="description" required /></label><label className="field">Funcionário<select name="employeeId" required><option value="">Selecione</option>{people.filter(p => p.type === "EMPLOYEE").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field">Valor estimado<input name="value" type="number" min="0" step="0.01" required /></label><button className="btn">Adicionar serviço</button></MaintenanceForm></section>
      <section className="card mt"><h2>Fechar ordem de serviço</h2><p>{o.workId ? "O fechamento lançará o total da ordem no centro de custos da obra, como Reembolso de Manutenção." : "Ordem sem obra: o fechamento não gera lançamento no centro de custos."}</p><MaintenanceForm action={finishMaintenance} confirmMessage="Fechar esta ordem de serviço? Após o fechamento, a ordem não poderá ser alterada.">{hidden}<label className="field">Data do fechamento<input name="date" type="date" defaultValue={today} max={today} required /></label><label className="field">O problema foi resolvido?<select name="resolved" required defaultValue=""><option value="">Selecione</option><option value="true">Sim, serviço efetivado</option><option value="false">Não, permanece pendente</option></select></label><label className="field span-2">Descrição do resultado<textarea name="closingNotes" required /></label><button className="btn">Fechar ordem de serviço</button></MaintenanceForm></section>
      <section className="card mt"><h2>Excluir ordem aberta</h2><p>A exclusão devolve ao estoque as peças retiradas por esta ordem.</p><MaintenanceForm action={deleteMaintenance} confirmMessage={`Excluir definitivamente a OS nº ${o.number} e desfazer suas baixas de peças?`}>{hidden}<button className="btn secondary">Excluir ordem</button></MaintenanceForm></section>
    </>}
  </>;
}
