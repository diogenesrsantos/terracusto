import { ProductsManager } from "@/components/products-manager";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 20;
export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("stock.manage"); const requested = Number.parseInt((await searchParams).page || "1", 10);
  const total = await db.product.count(), totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE)), page = Math.min(Math.max(requested || 1, 1), totalPages);
  const [products, groups] = await Promise.all([db.product.findMany({ include: { group: true }, orderBy: { number: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }), db.productGroup.findMany({ orderBy: { name: "asc" } })]);
  return <><PageHead title="Cadastro de produtos" subtitle="Produtos, grupos, valores atuais e controle opcional de vencimento." /><ProductsManager products={products.map((product) => ({ id: product.id, number: product.number, name: product.name, unit: product.unit, minimum: product.minimum.toString(), currentUnitCost: product.currentUnitCost?.toString() || "", requiresExpiry: product.requiresExpiry, active: product.active, groupId: product.groupId, groupName: product.group.name }))} groups={groups} page={page} totalPages={totalPages} total={total} /></>;
}
