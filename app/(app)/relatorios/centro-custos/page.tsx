import { PageHead, Empty } from "@/components/page";
import { PrintButton } from "@/components/print-button";
import { ReportHeader } from "@/components/report-header";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money, number, timeInput } from "@/lib/format";

type SearchParams = { workId?: string; competence?: string | string[]; mode?: string };

const values = (value: string | string[] | undefined) => value ? (Array.isArray(value) ? value : [value]) : [];
const validCompetence = (value: string) => /^\d{4}-\d{2}$/.test(value);
const competenceDate = (value: string) => new Date(`${value}-01T00:00:00.000Z`);
const competenceLabel = (value: string) => competenceDate(value).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function CostCenterReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission("accounting.manage");
  const params = await searchParams;
  const works = await db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const selectedWork = works.find((work) => work.id === params.workId);
  const availableCompetences = selectedWork ? await db.accountingEntry.findMany({
    where: { workId: selectedWork.id, entryTypeId: { not: null } },
    distinct: ["competence"], select: { competence: true }, orderBy: { competence: "desc" },
  }) : [];
  const available = availableCompetences.map(({ competence }) => competence.toISOString().slice(0, 7));
  const selectedCompetences = values(params.competence).filter((value, index, all) => validCompetence(value) && available.includes(value) && all.indexOf(value) === index).sort();
  const mode = params.mode === "detail" ? "detail" : "summary";
  const reportEntries = selectedWork && selectedCompetences.length > 0 ? await db.accountingEntry.findMany({
    where: { workId: selectedWork.id, entryTypeId: { not: null }, competence: { in: selectedCompetences.map(competenceDate) } },
    include: { person: true, asset: true, entryType: true, lines: { include: { account: true } } },
    orderBy: [{ competence: "asc" }, { date: "asc" }, { createdAt: "asc" }],
  }) : [];

  const summaries = selectedCompetences.map((competence) => {
    const entries = reportEntries.filter((entry) => entry.competence.toISOString().slice(0, 7) === competence);
    return {
      competence, count: entries.length,
      amount: entries.reduce((total, entry) => total + Number(entry.lines.find((line) => Number(line.debit) > 0)?.debit || 0), 0),
      hours: entries.reduce((total, entry) => total + Number(entry.hours || 0), 0),
    };
  });
  const totalAmount = summaries.reduce((total, summary) => total + summary.amount, 0);
  const totalHours = summaries.reduce((total, summary) => total + summary.hours, 0);

  return <>
    <div className="no-print"><PageHead title="Relatório de centro de custos" subtitle="Consulte os lançamentos de uma obra por uma ou mais competências." /></div>
    <section className="card no-print">
      <form method="get" className="form-grid">
        <label className="field span-2">Centro de custo / obra<select name="workId" defaultValue={selectedWork?.id || ""} required><option value="">Selecione um centro de custo ativo</option>{works.map((work) => <option key={work.id} value={work.id}>{work.code} — {work.name}</option>)}</select></label>
        <label className="field span-2">Tipo de relatório<select name="mode" defaultValue={mode}><option value="summary">Resumo por competência</option><option value="detail">Detalhado</option></select></label>
        <fieldset className="report-competences span-4"><legend>Competência(s)</legend>{!selectedWork ? <p className="muted">Selecione o centro de custo para carregar as competências.</p> : available.length === 0 ? <p className="muted">Não há lançamentos com competência nesta obra.</p> : <div className="report-competence-list">{available.map((competence) => <label key={competence}><input className="inline-checkbox" type="checkbox" name="competence" value={competence} defaultChecked={selectedCompetences.includes(competence)} />{competenceLabel(competence)}</label>)}</div>}</fieldset>
        <div className="form-actions"><button className="btn" type="submit">Gerar relatório</button></div>
      </form>
    </section>

    {selectedWork && selectedCompetences.length > 0 && <section className="report-sheet">
      <div className="report-actions no-print"><PrintButton /></div>
      <ReportHeader title="Relatório de centro de custos" />
      <div className="report-meta"><strong>Centro de custo:</strong> {selectedWork.code} — {selectedWork.name}<br /><strong>Competências:</strong> {selectedCompetences.map(competenceLabel).join(", ")}<br /><strong>Tipo:</strong> {mode === "detail" ? "Detalhado" : "Resumo por competência"}</div>
      {mode === "summary" ? <>
        <h2>Totais por competência</h2>
        <div className="table-wrap"><table><thead><tr><th>Competência</th><th className="text-right">Lançamentos</th><th className="text-right">Horas</th><th className="text-right">Total cobrado</th></tr></thead><tbody>{summaries.map((summary) => <tr key={summary.competence}><td>{competenceLabel(summary.competence)}</td><td className="text-right">{summary.count}</td><td className="text-right">{number(summary.hours)}</td><td className="text-right">{money(summary.amount)}</td></tr>)}</tbody><tfoot><tr><th>Total geral</th><th className="text-right">{reportEntries.length}</th><th className="text-right">{number(totalHours)}</th><th className="text-right">{money(totalAmount)}</th></tr></tfoot></table></div>
      </> : <>
        <h2>Lançamentos detalhados</h2>
        {reportEntries.length === 0 ? <Empty>Nenhum lançamento encontrado para as competências selecionadas.</Empty> : <div className="table-wrap"><table><thead><tr><th>Competência</th><th>Data</th><th>Tipo / histórico</th><th>Equipamento / operador</th><th>Horários</th><th>Contas</th><th className="text-right">Valor</th></tr></thead><tbody>{reportEntries.map((entry) => { const amount = entry.lines.find((line) => Number(line.debit) > 0)?.debit || 0; return <tr key={entry.id}><td>{competenceLabel(entry.competence.toISOString().slice(0, 7))}</td><td>{date(entry.date)}</td><td><strong>{entry.entryType?.name || "Sem tipo"}</strong><br />{entry.history || "—"}<br /><small className="muted">{entry.document || "Sem documento"}</small></td><td>{entry.asset ? `${entry.asset.identifier} — ${entry.asset.description}` : "—"}<br /><small>{entry.person?.name || "—"}</small></td><td>{entry.startAt ? `${timeInput(entry.startAt)} — ${timeInput(entry.endAt)}` : "—"}{entry.secondStartAt && entry.secondEndAt && <><br />{timeInput(entry.secondStartAt)} — {timeInput(entry.secondEndAt)}</>}</td><td>{entry.lines.map((line) => <small key={line.id} style={{ display: "block" }}>{Number(line.debit) > 0 ? "D" : "C"} · {line.account.code} {line.account.name}</small>)}</td><td className="text-right">{money(amount)}</td></tr>; })}</tbody><tfoot><tr><th colSpan={6}>Total geral</th><th className="text-right">{money(totalAmount)}</th></tr></tfoot></table></div>}
      </>}
      <p className="report-footer">Relatório emitido em {date(new Date())} · Total de horas: {number(totalHours)}</p>
    </section>}
  </>;
}
