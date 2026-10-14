"use server";

import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { assertOpen } from "@/lib/accounting-period";
import { audit } from "@/lib/audit";
import { businessToday } from "@/lib/format";

const text = (f: FormData, k: string) => String(f.get(k) || "").trim();
const amount = (f: FormData, k: string) => {
  const v = new Prisma.Decimal(text(f, k).replace(",", ".") || "0");
  if (!v.isFinite() || v.lt(0)) throw new Error("Informe um valor válido, maior ou igual a zero.");
  return v;
};
const date = (f: FormData) => {
  const value = text(f, "date"), d = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value || d > businessToday()) throw new Error("Informe uma data válida, até hoje.");
  return d;
};
const refresh = (id: string) => {
  for (const path of ["/manutencao", `/manutencao/${id}`, `/manutencao/${id}/relatorio`, "/almoxarifado", "/almoxarifado/historico", "/lancamentos", "/relatorios/centro-custos", "/"]) revalidatePath(path);
};
async function editable(tx: Prisma.TransactionClient, id: string) {
  const order = await tx.maintenanceOrder.findUniqueOrThrow({ where: { id } });
  if (["DONE", "CANCELED"].includes(order.status)) throw new Error("Esta ordem está fechada e não pode ser alterada.");
  return order;
}
const serial = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

async function updateMaintenanceCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id");
  const kind = text(f, "kind"), status = text(f, "status");
  if (!["PREVENTIVE", "CORRECTIVE"].includes(kind) || !["OPEN", "IN_PROGRESS", "WAITING_PART"].includes(status) || !text(f, "complaint")) throw new Error("Preencha tipo, situação e solicitação.");
  await db.$transaction(async tx => {
    await editable(tx, id);
    const assetId = text(f, "assetId"), workId = text(f, "workId") || null, mechanicId = text(f, "mechanicId") || null;
    if (!await tx.asset.count({ where: { id: assetId, active: true } })) throw new Error("Selecione equipamento ativo.");
    if (workId && !await tx.work.count({ where: { id: workId, active: true } })) throw new Error("Selecione obra ativa.");
    if (mechanicId && !await tx.person.count({ where: { id: mechanicId, active: true } })) throw new Error("Selecione responsável ativo.");
    await tx.maintenanceOrder.update({ where: { id }, data: { kind: kind as "PREVENTIVE" | "CORRECTIVE", status: status as "OPEN" | "IN_PROGRESS" | "WAITING_PART", assetId, workId, mechanicId, complaint: text(f, "complaint"), meter: text(f, "meter") ? amount(f, "meter") : null } });
    const parts = await tx.maintenancePart.findMany({ where: { orderId: id, operationId: { not: null } }, select: { operationId: true } });
    await tx.stockMovement.updateMany({ where: { operationId: { in: parts.map(p => p.operationId!) } }, data: { workId } });
  }, serial);
  await audit(user.userId, "UPDATE", "MaintenanceOrder", id); refresh(id);
}

async function addMaintenancePartCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id"), source = text(f, "source"), added = date(f);
  const quantity = amount(f, "quantity"), unitCost = amount(f, "unitCost");
  if (!quantity.isInteger() || quantity.lte(0) || !["STOCK", "SUPPLIER"].includes(source)) throw new Error("Informe origem e quantidade inteira positiva.");
  await db.$transaction(async tx => {
    const order = await editable(tx, id);
    const operationId = randomUUID();
    let productId: string | null = null, description = text(f, "description");
    if (source === "STOCK") {
      const product = await tx.product.findFirstOrThrow({ where: { id: text(f, "productId"), active: true } });
      productId = product.id; description = product.name;
      const rows = await tx.stockMovement.groupBy({ by: ["kind"], where: { productId }, _sum: { quantity: true } });
      const balance = rows.reduce((sum, r) => sum.plus((r._sum.quantity || new Prisma.Decimal(0)).mul(r.kind === "OUT" ? -1 : 1)), new Prisma.Decimal(0));
      if (balance.lt(quantity)) throw new Error("Estoque insuficiente para esta peça.");
      await tx.stockMovement.create({ data: { date: added, kind: "OUT", productId, quantity, unitCost, operationId, workId: order.workId, document: `OS-${order.number}`, history: `Peça da OS nº ${order.number}`, createdById: user.userId } });
    } else if (!description || !text(f, "invoice")) throw new Error("Informe a descrição da peça e o número da nota fiscal.");
    await tx.maintenancePart.create({ data: { orderId: id, productId, description, quantity, unitCost, date: added, source, invoice: source === "SUPPLIER" ? text(f, "invoice") : null, operationId } });
  }, serial);
  await audit(user.userId, "ADD_PART", "MaintenanceOrder", id); refresh(id);
}

async function removeMaintenancePartCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id");
  await db.$transaction(async tx => {
    await editable(tx, id);
    const part = await tx.maintenancePart.findFirstOrThrow({ where: { id: text(f, "partId"), orderId: id } });
    if (part.source === "STOCK" && !part.operationId) throw new Error("Peça legada sem vínculo de estoque: remoção indisponível.");
    if (part.operationId) await tx.stockMovement.deleteMany({ where: { operationId: part.operationId } });
    await tx.maintenancePart.delete({ where: { id: part.id } });
  }, serial);
  await audit(user.userId, "REMOVE_PART", "MaintenanceOrder", id); refresh(id);
}

async function addMaintenanceServiceCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id"), serviceDate = date(f);
  if (!text(f, "description")) throw new Error("Informe o serviço executado.");
  const value = amount(f, "value");
  await db.$transaction(async tx => {
    await editable(tx, id);
    const employeeId = text(f, "employeeId");
    if (!await tx.person.count({ where: { id: employeeId, active: true, type: "EMPLOYEE" } })) throw new Error("Selecione um funcionário ativo.");
    await tx.maintenanceService.create({ data: { orderId: id, date: serviceDate, description: text(f, "description"), employeeId, value } });
  }, serial);
  await audit(user.userId, "ADD_SERVICE", "MaintenanceOrder", id); refresh(id);
}

async function removeMaintenanceServiceCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id");
  await db.$transaction(async tx => { await editable(tx, id); await tx.maintenanceService.delete({ where: { id: text(f, "serviceId"), orderId: id } }); }, serial);
  await audit(user.userId, "REMOVE_SERVICE", "MaintenanceOrder", id); refresh(id);
}

async function deleteMaintenanceCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id");
  await db.$transaction(async tx => {
    await editable(tx, id);
    const parts = await tx.maintenancePart.findMany({ where: { orderId: id } });
    if (parts.some(p => p.source === "STOCK" && !p.operationId)) throw new Error("Ordem com peças legadas sem vínculo de estoque não pode ser excluída.");
    await tx.stockMovement.deleteMany({ where: { operationId: { in: parts.flatMap(p => p.operationId ? [p.operationId] : []) } } });
    await tx.maintenanceOrder.delete({ where: { id } });
  }, serial);
  await audit(user.userId, "DELETE", "MaintenanceOrder", id); refresh(id); redirect("/manutencao");
}

async function finishMaintenanceCore(f: FormData) {
  const user = await requirePermission("maintenance.manage"), id = text(f, "id"), closingDate = date(f);
  if (!["true", "false"].includes(text(f, "resolved")) || !text(f, "closingNotes")) throw new Error("Informe o resultado e a descrição do fechamento.");
  const initial = await db.maintenanceOrder.findUniqueOrThrow({ where: { id } });
  const competence = initial.workId ? await assertOpen(initial.workId, closingDate) : null;
  await db.$transaction(async tx => {
    const order = await editable(tx, id);
    if (order.workId !== initial.workId) throw new Error("A obra mudou. Atualize a página e tente novamente.");
    const parts = await tx.maintenancePart.findMany({ where: { orderId: id } }), services = await tx.maintenanceService.findMany({ where: { orderId: id } });
    if (closingDate < new Date(order.openedAt.toISOString().slice(0, 10) + "T12:00:00Z") || [...parts, ...services].some(p => p.date > closingDate)) throw new Error("O fechamento não pode ser anterior à abertura, às peças ou aos serviços.");
    const total = parts.reduce((sum, p) => sum.plus(p.quantity.mul(p.unitCost).toDecimalPlaces(2)), order.externalCost).plus(services.reduce((sum, s) => sum.plus(s.value), new Prisma.Decimal(0)));
    let entryId: string | null = null;
    if (order.workId && competence) {
      const period = await tx.accountingPeriod.findUnique({ where: { workId_competence: { workId: order.workId, competence } } });
      if (!period || period.status !== "OPEN") throw new Error("A competência foi fechada. Atualize a página.");
      const type = await tx.entryType.findFirst({ where: { name: "Reembolso de Manutenção", active: true }, include: { defaultDebitAccount: true, defaultCreditAccount: true } });
      if (!type || !type.defaultDebitAccount.active || !type.defaultCreditAccount.active || !type.defaultDebitAccount.analytic || !type.defaultCreditAccount.analytic || type.defaultDebitAccount.code !== "1.2" || type.defaultCreditAccount.nature !== "CREDIT") throw new Error("Configure o tipo Reembolso de Manutenção com Clientes e uma conta credora analítica ativa.");
      const operationId = randomUUID();
      const entry = await tx.accountingEntry.create({ data: { workId: order.workId, assetId: order.assetId, entryTypeId: type.id, date: closingDate, competence, operationId, document: `OS-${order.number}`, history: `OS nº ${order.number} — ${order.complaint} — ${text(f, "resolved") === "true" ? "Problema resolvido" : "Problema não resolvido"}`, createdById: user.userId, lines: { create: [{ operationId, accountId: type.defaultDebitAccountId, debit: total, credit: 0 }, { operationId, accountId: type.defaultCreditAccountId, debit: 0, credit: total }] } } });
      entryId = entry.id;
    }
    await tx.maintenanceOrder.update({ where: { id }, data: { status: "DONE", finishedAt: closingDate, resolved: text(f, "resolved") === "true", closingNotes: text(f, "closingNotes"), entryId } });
  }, serial);
  await audit(user.userId, "FINISH", "MaintenanceOrder", id); refresh(id);
}

async function feedback(action: (f: FormData) => Promise<void>, f: FormData) {
  try { await action(f); return { error: "" }; }
  catch (error) {
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError) return { error: error.code === "P2034" ? "A ordem ou o estoque mudou durante a operação. Atualize a página e tente novamente." : "O registro não está disponível para esta operação. Atualize a página." };
    return { error: error instanceof Error ? error.message : "Não foi possível concluir a operação." };
  }
}
export async function updateMaintenance(f: FormData) { return feedback(updateMaintenanceCore, f); }
export async function addMaintenancePart(f: FormData) { return feedback(addMaintenancePartCore, f); }
export async function removeMaintenancePart(f: FormData) { return feedback(removeMaintenancePartCore, f); }
export async function addMaintenanceService(f: FormData) { return feedback(addMaintenanceServiceCore, f); }
export async function removeMaintenanceService(f: FormData) { return feedback(removeMaintenanceServiceCore, f); }
export async function deleteMaintenance(f: FormData) { return feedback(deleteMaintenanceCore, f); }
export async function finishMaintenance(f: FormData) { return feedback(finishMaintenanceCore, f); }
