import { assignActivity, createActivity, createPerson } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const typeLabel = { EMPLOYEE: "Funcionário", CONTRACTOR: "Terceirizado", OTHER: "Outro" };
export default async function PeoplePage() {
  await requirePermission("people.manage");
  const [people, activities] = await Promise.all([
    db.person.findMany({ include: { activities: { include: { activity: true } } }, orderBy: { name: "asc" } }),
    db.activity.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Pessoas" subtitle="Funcionários, operadores, motoristas, mecânicos e terceiros." />
    <section className="card"><h2>Novo cadastro</h2><form action={createPerson} className="form-grid">
      <label className="field span-2">Nome completo<input name="name" required /></label>
      <label className="field">CPF<input name="cpf" inputMode="numeric" /></label>
      <label className="field">Tipo<select name="type"><option value="EMPLOYEE">Funcionário</option><option value="CONTRACTOR">Terceirizado</option><option value="OTHER">Outro</option></select></label>
      <label className="field">Função<input name="roleTitle" placeholder="Motorista, mecânico..." /></label>
      <label className="field">Telefone<input name="phone" /></label><label className="field span-2">E-mail<input name="email" type="email" /></label>
      <label className="field span-3">Observações<input name="notes" /></label><button className="btn">Cadastrar pessoa</button>
    </form></section>
    <section className="grid grid-2 mt"><div className="card"><h2>Nova atividade</h2><form action={createActivity} className="grid grid-2"><label className="field">Atividade<input name="name" placeholder="Ex.: Operar motoniveladora" required /></label><button className="btn">Cadastrar atividade</button></form></div>
      <div className="card"><h2>Vincular atividade</h2><form action={assignActivity} className="form-grid"><label className="field span-2">Pessoa<select name="personId" required>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="field">Atividade<select name="activityId" required>{activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button className="btn">Vincular</button></form></div></section>
    <section className="card mt"><h2>Cadastros</h2>{people.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Função e atividades</th><th>CPF</th><th>Contato</th><th>Situação</th></tr></thead><tbody>
      {people.map((p) => <tr key={p.id}><td><strong>{p.name}</strong><br /><small className="muted">{typeLabel[p.type]}</small></td><td>{p.roleTitle || "—"}<br /><small>{p.activities.map((a) => a.activity.name).join(", ")}</small></td><td>{p.cpf || "—"}</td><td>{p.phone || p.email || "—"}</td><td><span className="badge">{p.active ? "Ativo" : "Inativo"}</span></td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
