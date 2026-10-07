import { StockEntryForm } from "@/components/stock-entry-form";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInput } from "@/lib/format";

export default async function StockEntriesPage() {
  await requirePermission("stock.manage"); const groups = await db.productGroup.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <><PageHead title="Entradas no estoque" subtitle="Registre entradas por nota fiscal sem misturar com as baixas de estoque." /><StockEntryForm groups={groups} today={dateInput(new Date())} /></>;
}
