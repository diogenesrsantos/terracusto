import { createAccount } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function AccountsPage() {
  await requirePermission("accounting.manage"); const accounts = await db.account.findMany({ include: { parent: true }, orderBy: { code: "asc" } });
  return <><PageHead title="Plano de contas" subtitle="Estrutura contábil utilizada nos lançamentos e balancetes." />
    <section className="card"><h2>Nova conta</h2><form action={createAccount} className="form-grid">
      <label className="field">Código<input name="code" placeholder="4.5" required /></label><label className="field span-2">Nome<input name="name" required /></label>
      <label className="field">Natureza<select name="nature"><option value="DEBIT">Devedora</option><option value="CREDIT">Credora</option></select></label>
      <label className="field span-2">Conta superior<select name="parentId"><option value="">Sem conta superior</option>{accounts.filter((a) => !a.analytic).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field">Tipo<select name="analytic"><option value="true">Analítica (recebe lançamento)</option><option value="false">Sintética (agrupadora)</option></select></label>
      <button className="btn">Criar conta</button>
    </form></section>
    <section className="card mt"><h2>Contas cadastradas</h2>{accounts.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Natureza</th><th>Tipo</th><th>Situação</th></tr></thead><tbody>
      {accounts.map((a) => <tr key={a.id}><td><strong>{a.code}</strong></td><td>{a.name}</td><td>{a.nature === "DEBIT" ? "Devedora" : "Credora"}</td><td>{a.analytic ? "Analítica" : "Sintética"}</td><td><span className="badge">{a.active ? "Ativa" : "Inativa"}</span></td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
