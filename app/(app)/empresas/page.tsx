import { CompaniesManager } from "@/components/companies-manager";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 20;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("companies.manage");
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const totalCompanies = await db.company.count();
  const totalPages = Math.max(1, Math.ceil(totalCompanies / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const companies = await db.company.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });

  return <><PageHead title="Empresas" subtitle="Cadastro único de clientes de obras e fornecedores de combustível." />
    <CompaniesManager key={page} companies={companies} page={page} totalPages={totalPages} totalCompanies={totalCompanies} />
  </>;
}
