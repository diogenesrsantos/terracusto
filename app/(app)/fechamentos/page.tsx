import { closePeriod, reopenPeriod } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getPermissions, requirePermission } from "@/lib/auth";

export default async function ClosingsPage() {
  const user = await requirePermission("closing.close"); const permissions = await getPermissions(user.userId);
  const [works, periods, closings] = await Promise.all([
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.accountingPeriod.findMany({ where: { status: "CLOSED" }, include: { work: true }, orderBy: { competence: "desc" }, take: 24 }),
    db.monthlyClosing.findMany({ include: { work: true, account: true }, orderBy: [{ competence: "desc" }, { account: { code: "asc" } }], take: 200 }),
  ]);
  return <><PageHead title="Fechamentos mensais" subtitle="Consolidação de débitos, créditos e saldos por obra." />
    <section className="grid grid-2"><div className="card"><h2>Fechar competência</h2><form action={closePeriod} className="grid">
      <label className="field">Obra<select name="workId" required><option value="">Selecione</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field">Competência<input name="competence" type="month" required /></label><button className="btn">Fechar e transportar saldos</button>
    </form></div>
    {permissions.has("closing.reopen") && <div className="card"><h2>Reabrir competência</h2><form action={reopenPeriod} className="grid">
      <label className="field">Competência fechada<select name="periodId" required><option value="">Selecione</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.work.code} — {p.competence.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}</option>)}</select></label>
      <label className="field">Sua senha<input name="password" type="password" required /></label><label className="field">Justificativa<input name="reason" minLength={5} required /></label><button className="btn danger">Reabrir período</button>
    </form></div>}</section>
    <section className="card mt"><h2>Balancete de competências fechadas</h2>{closings.length === 0 ? <Empty>Nenhuma competência foi fechada.</Empty> : <div className="table-wrap"><table><thead><tr><th>Competência</th><th>Obra</th><th>Conta</th><th className="text-right">Saldo anterior</th><th className="text-right">Débitos</th><th className="text-right">Créditos</th><th className="text-right">Saldo final</th></tr></thead><tbody>
      {closings.map((c) => <tr key={c.id}><td>{c.competence.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" })}</td><td>{c.work.code}</td><td>{c.account.code} — {c.account.name}</td><td className="text-right">{money(c.openingBalance)}</td><td className="text-right">{money(c.totalDebit)}</td><td className="text-right">{money(c.totalCredit)}</td><td className="text-right"><strong>{money(c.closingBalance)}</strong></td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
