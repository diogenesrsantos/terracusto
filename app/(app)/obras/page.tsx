import { PageHead } from "@/components/page";
import { WorksManager } from "@/components/works-manager";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

const PAGE_SIZE = 20;

export default async function WorksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("works.manage");
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const totalWorks = await db.work.count();
  const totalPages = Math.max(1, Math.ceil(totalWorks / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const [works, companies] = await Promise.all([
    db.work.findMany({ include: { company: true }, orderBy: [{ code: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.company.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
  ]);

  return <><PageHead title="Obras" subtitle="Cada obra corresponde a um único centro de custo." />
    <WorksManager key={page} works={works.map((work) => ({
      id: work.id, code: work.code, name: work.name, companyId: work.companyId,
      companyName: work.company?.name || null, description: work.description,
      startDate: work.startDate ? dateInput(work.startDate) : "",
      startDateLabel: work.startDate?.toLocaleDateString("pt-BR", { timeZone: "UTC" }) || "—", active: work.active,
    }))} companies={companies.map(({ id, name, active }) => ({ id, name, active }))} page={page} totalPages={totalPages} totalWorks={totalWorks} />
  </>;
}
