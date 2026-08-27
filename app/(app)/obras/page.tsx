import { createWork } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function WorksPage() {
  await requirePermission("works.manage"); const works = await db.work.findMany({ orderBy: { code: "asc" } });
  return <><PageHead title="Obras" subtitle="Cada obra corresponde a um único centro de custo." />
    <section className="card"><h2>Nova obra</h2><form action={createWork} className="form-grid">
      <label className="field span-2">Nome da obra<input name="name" required /></label><label className="field">Início<input name="startDate" type="date" /></label>
      <label className="field span-2">Cliente<input name="client" required /></label><label className="field">Descrição<input name="description" /></label>
      <button className="btn span-4">Cadastrar obra</button>
    </form></section>
    <section className="card mt"><h2>Obras cadastradas</h2>{works.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Obra</th><th>Cliente</th><th>Início</th><th>Situação</th></tr></thead><tbody>
      {works.map((w) => <tr key={w.id}><td><strong>{w.code}</strong></td><td>{w.name}</td><td>{w.client}</td><td>{w.startDate?.toLocaleDateString("pt-BR", { timeZone: "UTC" }) || "—"}</td><td><span className="badge">{w.active ? "Ativa" : "Encerrada"}</span></td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
