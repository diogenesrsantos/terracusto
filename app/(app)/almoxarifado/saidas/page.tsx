import { StockIssueManager } from "@/components/stock-issue-manager";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/format";

export default async function StockIssuesPage() {
  const user = await requirePermission("stock.manage");
  const [draft, groups, works, accounts] = await Promise.all([db.stockIssue.findFirst({ where: { createdById: user.userId, status: { in: ["DRAFT", "CHECKED"] } }, include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } }, }, orderBy: { updatedAt: "desc" } }), db.productGroup.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.work.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }), db.account.findMany({ where: { active: true, analytic: true, nature: "DEBIT", code: { not: "1.4" } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } })]);
  const movementRows = draft?.items.length ? await db.stockMovement.groupBy({ by: ["productId", "kind"], where: { productId: { in: draft.items.map((item) => item.productId) } }, _sum: { quantity: true } }) : [];
  const balances = new Map<string, number>();
  for (const row of movementRows) balances.set(row.productId, (balances.get(row.productId) || 0) + (row.kind === "OUT" ? -1 : 1) * Number(row._sum.quantity || 0));
  const initialDraft = draft && { id: draft.id, number: draft.number, date: dateInput(draft.date), workId: draft.workId, debitAccountId: draft.debitAccountId, items: draft.items.map((item) => ({ id: item.id, productId: item.productId, product: { number: item.product.number, name: item.product.name, unit: item.product.unit, requiresExpiry: item.product.requiresExpiry, currentUnitCost: item.product.currentUnitCost?.toString() || "", balance: String(balances.get(item.productId) || 0) }, quantity: item.quantity.toString(), unitCost: item.unitCost.toString(), total: item.total.toString() })) };
  return <><PageHead title="Saídas do estoque" subtitle="Monte, confira e efetive uma lista de baixa vinculada a uma obra ou despesa." /><StockIssueManager initialDraft={initialDraft || null} groups={groups} works={works} accounts={accounts} today={dateInput(new Date())} /></>;
}
