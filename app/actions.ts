"use server";

import { compare, hash } from "bcryptjs";
import { Prisma, StockMovementKind } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clearSession, createSession, requirePermission, requireUser } from "@/lib/auth";
import { monthStart } from "@/lib/format";
import { checkLoginRate, recordLoginFailure, resetLoginRate } from "@/lib/rate-limit";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const optional = (form: FormData, key: string) => text(form, key) || null;
const decimal = (form: FormData, key: string) => new Prisma.Decimal(text(form, key).replace(",", ".") || 0);
const when = (form: FormData, key: string) => new Date(`${text(form, key)}T12:00:00Z`);

export async function login(form: FormData) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkLoginRate(ip)) redirect("/login?erro=limite");
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await compare(password, user.passwordHash))) {
    recordLoginFailure(ip); redirect("/login?erro=1");
  }
  resetLoginRate(ip);
  await createSession({ userId: user.id, name: user.name, email: user.email });
  await audit(user.id, "LOGIN", "User", user.id);
  redirect("/");
}

export async function createActivity(form: FormData) {
  const user = await requirePermission("people.manage");
  const row = await db.activity.create({ data: { name: text(form, "name") } });
  await audit(user.userId, "CREATE", "Activity", row.id); revalidatePath("/pessoas");
}

export async function assignActivity(form: FormData) {
  const user = await requirePermission("people.manage");
  const personId = text(form, "personId"), activityId = text(form, "activityId");
  await db.personActivity.upsert({ where: { personId_activityId: { personId, activityId } }, update: {}, create: { personId, activityId } });
  await audit(user.userId, "ASSIGN", "PersonActivity", `${personId}:${activityId}`); revalidatePath("/pessoas");
}

export async function logout() {
  const session = await requireUser();
  await audit(session.userId, "LOGOUT", "User", session.userId);
  await clearSession();
  redirect("/login");
}

export async function changePassword(form: FormData) {
  const session = await requireUser();
  const currentPassword = text(form, "currentPassword");
  const newPassword = text(form, "newPassword");
  const confirmation = text(form, "confirmation");
  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await compare(currentPassword, user.passwordHash))) throw new Error("A senha atual está incorreta.");
  if (newPassword.length < 10 || newPassword !== confirmation) throw new Error("A nova senha ou sua confirmação é inválida.");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(newPassword, 12) } });
  await audit(user.id, "CHANGE_PASSWORD", "User", user.id);
  redirect("/perfil?ok=1");
}

export async function createPerson(form: FormData) {
  const user = await requirePermission("people.manage");
  const row = await db.person.create({ data: {
    name: text(form, "name"), cpf: optional(form, "cpf"), phone: optional(form, "phone"),
    email: optional(form, "email"), roleTitle: optional(form, "roleTitle"),
    type: text(form, "type") as "EMPLOYEE" | "CONTRACTOR" | "OTHER", notes: optional(form, "notes"),
  }});
  await audit(user.userId, "CREATE", "Person", row.id);
  revalidatePath("/pessoas");
}

export async function createUser(form: FormData) {
  const user = await requirePermission("users.manage");
  const roleId = text(form, "roleId");
  const row = await db.user.create({ data: {
    name: text(form, "name"), email: text(form, "email").toLowerCase(),
    passwordHash: await hash(text(form, "password"), 12), personId: optional(form, "personId"),
    roles: { create: { roleId } },
  }});
  await audit(user.userId, "CREATE", "User", row.id);
  revalidatePath("/usuarios");
}

export async function createRole(form: FormData) {
  const user = await requirePermission("users.manage");
  const permissionIds = form.getAll("permissionId").map(String);
  const row = await db.role.create({ data: {
    code: text(form, "code").toUpperCase(), name: text(form, "name"),
    permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
  }});
  await audit(user.userId, "CREATE", "Role", row.id); revalidatePath("/usuarios");
}

export async function createWork(form: FormData) {
  const user = await requirePermission("works.manage");
  const row = await db.work.create({ data: {
    code: text(form, "code").toUpperCase(), name: text(form, "name"), client: text(form, "client"),
    description: optional(form, "description"), startDate: text(form, "startDate") ? when(form, "startDate") : null,
  }});
  await audit(user.userId, "CREATE", "Work", row.id);
  revalidatePath("/obras");
}

export async function createAsset(form: FormData) {
  const user = await requirePermission("assets.manage");
  const row = await db.asset.create({ data: {
    kind: text(form, "kind") as "MACHINE" | "VEHICLE" | "TOOL" | "OTHER",
    identifier: text(form, "identifier").toUpperCase().replace(/[^A-Z0-9-]/g, ""),
    description: text(form, "description"), brand: optional(form, "brand"), model: optional(form, "model"),
    fuelTypeId: optional(form, "fuelTypeId"), expectedUsage: text(form, "expectedUsage") ? decimal(form, "expectedUsage") : null,
  }});
  await audit(user.userId, "CREATE", "Asset", row.id);
  revalidatePath("/equipamentos");
}

export async function createAccount(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const row = await db.account.create({ data: {
    code: text(form, "code"), name: text(form, "name"),
    nature: text(form, "nature") as "DEBIT" | "CREDIT", analytic: text(form, "analytic") === "true",
    parentId: optional(form, "parentId"),
  }});
  await audit(user.userId, "CREATE", "Account", row.id);
  revalidatePath("/plano-contas");
}

async function assertOpen(workId: string, competence: Date) {
  const period = await db.accountingPeriod.findUnique({ where: { workId_competence: { workId, competence } } });
  if (period?.status === "CLOSED") throw new Error("Esta competência está fechada.");
}

export async function createEntry(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const workId = text(form, "workId");
  const date = when(form, "date");
  const competence = monthStart(date);
  const amount = decimal(form, "amount");
  const debitAccountId = text(form, "debitAccountId");
  const creditAccountId = text(form, "creditAccountId");
  if (amount.lte(0) || debitAccountId === creditAccountId) throw new Error("Valor e contas do lançamento são inválidos.");
  await assertOpen(workId, competence);
  const accounts = await db.account.count({ where: { id: { in: [debitAccountId, creditAccountId] }, active: true, analytic: true } });
  if (accounts !== 2) throw new Error("Use duas contas analíticas ativas.");
  let startAt: Date | null = null, endAt: Date | null = null, hours: Prisma.Decimal | null = null;
  if (text(form, "startAt") && text(form, "endAt")) {
    startAt = new Date(text(form, "startAt")); endAt = new Date(text(form, "endAt"));
    if (endAt <= startAt) throw new Error("A hora final deve ser posterior à inicial.");
    hours = new Prisma.Decimal((endAt.getTime() - startAt.getTime()) / 3_600_000);
  }
  const row = await db.accountingEntry.create({ data: {
    date, competence, history: text(form, "history"), document: optional(form, "document"), workId,
    personId: optional(form, "personId"), assetId: optional(form, "assetId"), startAt, endAt, hours,
    createdById: user.userId,
    lines: { create: [
      { accountId: debitAccountId, debit: amount, credit: 0 },
      { accountId: creditAccountId, debit: 0, credit: amount },
    ] },
  }});
  await audit(user.userId, "CREATE", "AccountingEntry", row.id);
  revalidatePath("/lancamentos"); revalidatePath("/");
}

export async function closePeriod(form: FormData) {
  const user = await requirePermission("closing.close");
  const workId = text(form, "workId");
  const competence = monthStart(`${text(form, "competence")}-01`);
  const next = new Date(Date.UTC(competence.getUTCFullYear(), competence.getUTCMonth() + 1, 1));
  await db.$transaction(async (tx) => {
    const existing = await tx.accountingPeriod.findUnique({ where: { workId_competence: { workId, competence } } });
    if (existing?.status === "CLOSED") throw new Error("Competência já fechada.");
    const accounts = await tx.account.findMany({ where: { active: true, analytic: true } });
    await tx.monthlyClosing.deleteMany({ where: { workId, competence } });
    for (const account of accounts) {
      const previous = await tx.monthlyClosing.findFirst({
        where: { workId, accountId: account.id, competence: { lt: competence } }, orderBy: { competence: "desc" },
      });
      const sums = await tx.accountingLine.aggregate({
        where: { accountId: account.id, entry: { workId, status: "POSTED", date: { gte: competence, lt: next } } },
        _sum: { debit: true, credit: true },
      });
      const opening = previous?.closingBalance ?? new Prisma.Decimal(0);
      const debit = sums._sum.debit ?? new Prisma.Decimal(0);
      const credit = sums._sum.credit ?? new Prisma.Decimal(0);
      const closing = account.nature === "DEBIT" ? opening.plus(debit).minus(credit) : opening.plus(credit).minus(debit);
      if (!opening.isZero() || !debit.isZero() || !credit.isZero()) await tx.monthlyClosing.create({ data: {
        workId, accountId: account.id, competence, openingBalance: opening,
        totalDebit: debit, totalCredit: credit, closingBalance: closing, closedById: user.userId,
      }});
    }
    await tx.accountingPeriod.upsert({
      where: { workId_competence: { workId, competence } },
      create: { workId, competence, status: "CLOSED", closedById: user.userId, closedAt: new Date() },
      update: { status: "CLOSED", closedById: user.userId, closedAt: new Date() },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CLOSE", "AccountingPeriod", `${workId}:${competence.toISOString()}`);
  revalidatePath("/fechamentos");
}

export async function reopenPeriod(form: FormData) {
  const user = await requirePermission("closing.reopen");
  const password = text(form, "password");
  const reason = text(form, "reason");
  const current = await db.user.findUniqueOrThrow({ where: { id: user.userId } });
  if (!(await compare(password, current.passwordHash)) || reason.length < 5) throw new Error("Senha ou justificativa inválida.");
  const period = await db.accountingPeriod.findUniqueOrThrow({ where: { id: text(form, "periodId") } });
  const workId = period.workId;
  const competence = period.competence;
  await db.$transaction([
    db.monthlyClosing.deleteMany({ where: { workId, competence } }),
    db.accountingPeriod.update({ where: { workId_competence: { workId, competence } }, data: { status: "OPEN", closedAt: null, closedById: null } }),
  ]);
  await audit(user.userId, "REOPEN", "AccountingPeriod", `${workId}:${competence.toISOString()}`, undefined, reason);
  revalidatePath("/fechamentos");
}

export async function createSupplier(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const row = await db.supplier.create({ data: { name: text(form, "name"), document: optional(form, "document"), isFuelStation: true } });
  await audit(user.userId, "CREATE", "Supplier", row.id); revalidatePath("/combustivel");
}

export async function createFuelPurchase(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const date = when(form, "date"); const competence = monthStart(date); const workId = text(form, "workId");
  await assertOpen(workId, competence);
  const liters = decimal(form, "liters"); const unitPrice = decimal(form, "unitPrice"); const total = liters.mul(unitPrice).toDecimalPlaces(2);
  const row = await db.$transaction(async (tx) => {
    const entry = await tx.accountingEntry.create({ data: {
      date, competence, history: `Compra de combustível - cupom ${text(form, "coupon")}`,
      document: text(form, "coupon"), workId, createdById: user.userId,
      lines: { create: [
        { accountId: text(form, "debitAccountId"), debit: total, credit: 0 },
        { accountId: text(form, "creditAccountId"), debit: 0, credit: total },
      ] },
    }});
    return tx.fuelPurchase.create({ data: {
      date, coupon: text(form, "coupon"), liters, unitPrice, total,
      supplierId: text(form, "supplierId"), fuelTypeId: text(form, "fuelTypeId"), workId,
      entryId: entry.id, createdById: user.userId,
    }});
  });
  await audit(user.userId, "CREATE", "FuelPurchase", row.id); revalidatePath("/combustivel");
}

export async function createFuelDispense(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const fuelTypeId = text(form, "fuelTypeId"); const liters = decimal(form, "liters");
  const [purchases, dispenses] = await Promise.all([
    db.fuelPurchase.aggregate({ where: { fuelTypeId }, _sum: { liters: true } }),
    db.fuelDispense.aggregate({ where: { fuelTypeId }, _sum: { liters: true } }),
  ]);
  const available = (purchases._sum.liters ?? new Prisma.Decimal(0)).minus(dispenses._sum.liters ?? 0);
  if (liters.lte(0) || liters.gt(available)) throw new Error("Saldo de combustível insuficiente.");
  const row = await db.fuelDispense.create({ data: {
    date: when(form, "date"), liters, meter: text(form, "meter") ? decimal(form, "meter") : null,
    notes: optional(form, "notes"), fuelTypeId, assetId: text(form, "assetId"), workId: text(form, "workId"),
    personId: optional(form, "personId"), createdById: user.userId,
  }});
  await audit(user.userId, "CREATE", "FuelDispense", row.id); revalidatePath("/combustivel");
}

export async function createProduct(form: FormData) {
  const user = await requirePermission("stock.manage");
  const row = await db.product.create({ data: {
    code: text(form, "code").toUpperCase(), name: text(form, "name"), unit: text(form, "unit"), minimum: decimal(form, "minimum"),
  }});
  await audit(user.userId, "CREATE", "Product", row.id); revalidatePath("/almoxarifado");
}

export async function createStockMovement(form: FormData) {
  const user = await requirePermission("stock.manage"); const productId = text(form, "productId");
  const kind = text(form, "kind") as StockMovementKind; const quantity = decimal(form, "quantity");
  if (quantity.lte(0)) throw new Error("Quantidade inválida.");
  if (kind === "OUT") {
    const rows = await db.stockMovement.groupBy({ by: ["kind"], where: { productId }, _sum: { quantity: true } });
    const balance = rows.reduce((sum, row) => sum + (row.kind === "OUT" ? -1 : 1) * Number(row._sum.quantity || 0), 0);
    if (Number(quantity) > balance) throw new Error("Estoque insuficiente.");
  }
  const row = await db.stockMovement.create({ data: {
    date: when(form, "date"), kind, quantity, unitCost: text(form, "unitCost") ? decimal(form, "unitCost") : null,
    document: optional(form, "document"), requester: optional(form, "requester"), history: text(form, "history"),
    productId, workId: optional(form, "workId"), createdById: user.userId,
  }});
  await audit(user.userId, "CREATE", "StockMovement", row.id); revalidatePath("/almoxarifado");
}

export async function createMaintenance(form: FormData) {
  const user = await requirePermission("maintenance.manage");
  const row = await db.maintenanceOrder.create({ data: {
    kind: text(form, "kind") as "PREVENTIVE" | "CORRECTIVE", complaint: text(form, "complaint"),
    meter: text(form, "meter") ? decimal(form, "meter") : null, assetId: text(form, "assetId"),
    workId: optional(form, "workId"), mechanicId: optional(form, "mechanicId"), createdById: user.userId,
  }});
  await audit(user.userId, "CREATE", "MaintenanceOrder", row.id); revalidatePath("/manutencao");
}

export async function finishMaintenance(form: FormData) {
  const user = await requirePermission("maintenance.manage"); const id = text(form, "id");
  await db.maintenanceOrder.update({ where: { id }, data: {
    status: "DONE", finishedAt: new Date(), diagnosis: optional(form, "diagnosis"), service: optional(form, "service"),
    externalCost: decimal(form, "externalCost"),
  }});
  await audit(user.userId, "FINISH", "MaintenanceOrder", id); revalidatePath("/manutencao");
}
