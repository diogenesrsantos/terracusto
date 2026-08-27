import { PageHead } from "@/components/page";
import { CostCenterEntryForm, type CostCenterEntryItem } from "@/components/cost-center-entry-form";
import { db } from "@/lib/db";
import { businessToday, dateInput, monthStart, number, timeInput } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

const PAGE_SIZE = 20;

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ workId?: string; page?: string }> }) {
  await requirePermission("accounting.manage");
  const params = await searchParams;
  const today = businessToday();
  const currentCompetence = monthStart(today);
  const [works, accounts, people, assets, openPeriods, entryTypes] = await Promise.all([
    db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.account.findMany({ where: { active: true, analytic: true }, orderBy: { code: "asc" } }),
    db.person.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.asset.findMany({ where: { active: true }, orderBy: { identifier: "asc" } }),
    db.accountingPeriod.findMany({ where: { status: "OPEN", work: { active: true } }, orderBy: { competence: "asc" } }),
    db.entryType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const selectedWorkId = works.some((work) => work.id === params.workId) ? params.workId! : "";
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);
  const entryWhere = { workId: selectedWorkId, entryTypeId: { not: null } };
  const totalEntries = selectedWorkId ? await db.accountingEntry.count({ where: entryWhere }) : 0;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const entries = selectedWorkId ? await db.accountingEntry.findMany({
    where: entryWhere,
    include: { person: true, asset: true, entryType: true, lines: { include: { account: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  }) : [];

  const serializedEntries: CostCenterEntryItem[] = entries.map((entry) => {
    const debitLine = entry.lines.find((line) => Number(line.debit) > 0);
    const creditLine = entry.lines.find((line) => Number(line.credit) > 0);
    return {
      id: entry.id,
      date: dateInput(entry.date),
      history: entry.history,
      document: entry.document || "",
      amount: debitLine ? String(debitLine.debit) : "",
      entryTypeId: entry.entryTypeId || "",
      entryTypeName: entry.entryType?.name || "Sem tipo",
      debitAccountId: debitLine?.accountId || "",
      creditAccountId: creditLine?.accountId || "",
      accountSummary: entry.lines.map((line) => `${Number(line.debit) > 0 ? "D" : "C"} · ${line.account.code} ${line.account.name}`),
      assetId: entry.assetId || "",
      assetLabel: entry.asset ? `${entry.asset.identifier} — ${entry.asset.description}` : "",
      personId: entry.personId || "",
      personName: entry.person?.name || "",
      startTime: timeInput(entry.startAt),
      endTime: timeInput(entry.endAt),
      secondStartTime: timeInput(entry.secondStartAt),
      secondEndTime: timeInput(entry.secondEndAt),
      hours: entry.hours ? number(entry.hours) : "",
    };
  });

  const accountOptions = accounts.map((account) => ({ id: account.id, label: `${account.code} — ${account.name}` }));
  return <>
    <PageHead title="Centro de custos" subtitle="Receitas, despesas e serviços contabilizados por obra." />
    <CostCenterEntryForm
      key={`${selectedWorkId}:${page}`}
      today={dateInput(today)} initialWorkId={selectedWorkId} page={page} totalPages={totalPages}
      totalEntries={totalEntries} entries={serializedEntries}
      works={works.map((work) => {
        const open = openPeriods.find((period) => period.workId === work.id);
        const competence = open?.competence || currentCompetence;
        return { id: work.id, label: `${work.code} — ${work.name}`, competence: dateInput(competence), blocked: competence < currentCompetence };
      })}
      accounts={accountOptions}
      people={people.map((person) => ({ id: person.id, label: person.name }))}
      assets={assets.map((asset) => ({ id: asset.id, label: `${asset.identifier} — ${asset.description}` }))}
      entryTypes={entryTypes.map((entryType) => ({
        id: entryType.id, label: entryType.name,
        defaultDebitAccountId: entryType.defaultDebitAccountId,
        defaultCreditAccountId: entryType.defaultCreditAccountId,
      }))}
    />
  </>;
}
