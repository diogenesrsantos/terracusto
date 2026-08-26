import { createEntry } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function EntriesPage() {
  await requirePermission("accounting.manage");
  const [entries, works, accounts, people, assets] = await Promise.all([
    db.accountingEntry.findMany({ include: { work: true, person: true, asset: true, lines: { include: { account: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }), db.asset.findMany({ where: { active: true }, orderBy: { identifier: "asc" } }),
  ]);
  return <><PageHead title="Lançamentos" subtitle="Receitas, despesas e serviços contabilizados por obra." />
    <section className="card"><h2>Novo lançamento</h2><form action={createEntry} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Obra<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field span-2">Histórico<input name="history" required /></label><label className="field">Documento<input name="document" /></label>
      <label className="field">Conta debitada<select name="debitAccountId" required><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field">Conta creditada<select name="creditAccountId" required><option value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select></label>
      <label className="field">Valor (R$)<input name="amount" type="number" step="0.01" min="0.01" required /></label>
      <label className="field">Equipamento<select name="assetId"><option value="">Não se aplica</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}</select></label>
      <label className="field">Operador/motorista<select name="personId"><option value="">Não se aplica</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="field">Início do serviço<input name="startAt" type="datetime-local" /></label><label className="field">Final do serviço<input name="endAt" type="datetime-local" /></label>
      <button className="btn span-4">Contabilizar lançamento</button>
    </form></section>
    <section className="card mt"><h2>Últimos lançamentos</h2>{entries.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Obra</th><th>Histórico</th><th>Contas</th><th>Equipamento/pessoa</th><th>Horas</th><th className="text-right">Valor</th></tr></thead><tbody>
      {entries.map((e) => <tr key={e.id}><td>{e.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td><strong>{e.work.code}</strong></td><td>{e.history}<br /><small className="muted">{e.document || "Sem documento"}</small></td><td>{e.lines.map((l) => <small key={l.id} style={{display:"block"}}>{Number(l.debit) > 0 ? "D" : "C"} · {l.account.code} {l.account.name}</small>)}</td><td>{e.asset?.identifier || "—"}<br /><small>{e.person?.name}</small></td><td>{e.hours ? number(e.hours) : "—"}</td><td className="text-right">{money(e.lines.reduce((s, l) => s + Number(l.debit), 0))}</td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
