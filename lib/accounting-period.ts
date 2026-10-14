import { db } from "@/lib/db";
import { businessToday, monthStart } from "@/lib/format";

export async function assertOpen(workId: string, date: Date) {
  const today = businessToday();
  const currentCompetence = monthStart(today);
  const competence = monthStart(date);
  if (date > today) throw new Error("Não é permitido lançar em data futura.");
  const openPeriod = await db.accountingPeriod.findFirst({ where: { workId, status: "OPEN" }, orderBy: { competence: "asc" } });
  if (openPeriod && openPeriod.competence < currentCompetence) throw new Error("A competência anterior venceu. Feche-a antes de realizar novos lançamentos.");
  if (openPeriod && openPeriod.competence.getTime() !== competence.getTime()) throw new Error("A data deve pertencer à competência vigente da obra.");
  if (!openPeriod) {
    if (competence.getTime() !== currentCompetence.getTime()) throw new Error("A data deve pertencer ao mês vigente.");
    const period = await db.accountingPeriod.findUnique({ where: { workId_competence: { workId, competence } } });
    if (period?.status === "CLOSED") throw new Error("Esta competência está fechada.");
    if (!period) await db.accountingPeriod.create({ data: { workId, competence } });
  }
  return competence;
}
