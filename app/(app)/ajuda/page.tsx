import { HelpManager, type HelpGuideManagerItem } from "@/components/help-manager";
import { PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { HELP_PAGES } from "@/lib/help-pages";

export default async function HelpPage() {
  await requirePermission("help.manage");
  const guides = await db.helpGuide.findMany({ include: { steps: { orderBy: { position: "asc" }, include: { images: { orderBy: { position: "asc" }, select: { id: true, fileName: true } } } } }, orderBy: { pageKey: "asc" } });
  const serialized: HelpGuideManagerItem[] = guides.map((guide) => ({ ...guide, steps: guide.steps.map((step) => ({ id: step.id, position: step.position, title: step.title, content: step.content, images: step.images })) }));
  return <><PageHead title="Manuais de ajuda" subtitle="Crie orientações passo a passo com textos e imagens para cada módulo." /><HelpManager guides={serialized} pages={[...HELP_PAGES]} /></>;
}
