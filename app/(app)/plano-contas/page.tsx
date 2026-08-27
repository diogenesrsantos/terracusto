import Link from "next/link";
import { saveAccount } from "@/app/actions";
import { AccountTreeView } from "@/components/account-tree-view";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePermission("accounting.manage"); const accounts = await db.account.findMany({ orderBy: { code: "asc" } });
  const params = await searchParams;
  const editing = accounts.find((account) => account.id === params.edit) || null;
  const blockedParentIds = new Set<string>(editing ? [editing.id] : []);
  if (editing) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const account of accounts) if (account.parentId && blockedParentIds.has(account.parentId) && !blockedParentIds.has(account.id)) {
        blockedParentIds.add(account.id); changed = true;
      }
    }
  }
  const parentOptions = accounts.filter((account) => !account.analytic && !blockedParentIds.has(account.id));
  return <><PageHead title="Plano de contas" subtitle="Estrutura contábil utilizada nos lançamentos e balancetes." />
    <section className="card"><h2>{editing ? "Alteração de conta" : "Nova conta"}</h2><form key={editing?.id || "new"} action={saveAccount} className="form-grid">
      <input type="hidden" name="id" value={editing?.id || ""} />
      <label className="field">Código<input name="code" placeholder="4.5" defaultValue={editing?.code || ""} readOnly={Boolean(editing)} required /></label><label className="field span-2">Nome<input name="name" defaultValue={editing?.name || ""} required /></label>
      <label className="field">Natureza<select name="nature" defaultValue={editing?.nature || "DEBIT"} disabled={Boolean(editing)}><option value="DEBIT">Devedora</option><option value="CREDIT">Credora</option></select></label>
      <label className="field span-2">Conta superior<select name="parentId" defaultValue={editing?.parentId || ""}><option value="">Sem conta superior</option>{parentOptions.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
      <label className="field">Tipo<select name="analytic" defaultValue={editing ? String(editing.analytic) : "true"} disabled={Boolean(editing)}><option value="true">Analítica (recebe lançamento)</option><option value="false">Sintética (agrupadora)</option></select></label>
      <div className="form-actions">{editing && <Link className="btn secondary" href="/plano-contas">Cancelar alteração</Link>}<button className="btn">{editing ? "Salvar alteração" : "Criar conta"}</button></div>
    </form></section>
    <section className="card mt"><h2>Contas cadastradas</h2>{accounts.length === 0 ? <Empty /> : <AccountTreeView accounts={accounts} editingId={editing?.id} />}</section>
  </>;
}
