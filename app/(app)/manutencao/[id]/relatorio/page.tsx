import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ReportHeader } from "@/components/report-header";
import { PrintButton } from "@/components/print-button";
import { MaintenanceSummary } from "@/components/maintenance-summary";
export default async function MaintenanceReport({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("maintenance.manage"); const { id } = await params;
  const order = await db.maintenanceOrder.findUnique({ where: { id }, include: { asset: true, work: true, mechanic: true, parts: { include: { product: true }, orderBy: { date: "asc" } }, services: { include: { employee: true }, orderBy: { date: "asc" } } } });
  if (!order) notFound();
  return <><div className="no-print"><Link className="btn secondary" href={`/manutencao/${id}`}>Voltar à ordem</Link> <PrintButton /></div><article className="report-sheet maintenance-report"><ReportHeader title={`Ordem de serviço nº ${order.number}`} /><MaintenanceSummary order={order} /></article></>;
}
