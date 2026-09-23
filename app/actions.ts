"use server";

import { compare, hash } from "bcryptjs";
import { Prisma, StockMovementKind } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clearSession, createSession, requirePermission, requireUser } from "@/lib/auth";
import { businessToday, monthStart } from "@/lib/format";
import { checkLoginRate, recordLoginFailure, resetLoginRate } from "@/lib/rate-limit";
import { isThemeName } from "@/lib/themes";
import { isHelpPage } from "@/lib/help-pages";

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const optional = (form: FormData, key: string) => text(form, key) || null;
const decimal = (form: FormData, key: string) => new Prisma.Decimal(text(form, key).replace(",", ".") || 0);
const when = (form: FormData, key: string) => new Date(`${text(form, key)}T12:00:00Z`);
const REPORT_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const REPORT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const HELP_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const HELP_IMAGES_PER_STEP_MAX = 4;
const isSafeSvg = (content: string) => {
  const normalized = content.toLowerCase();
  return normalized.includes("<svg") && !/(<script\b|<foreignobject\b|<iframe\b|<object\b|<embed\b|<link\b|<style\b|<!doctype|<!entity|\bon\w+\s*=|javascript\s*:|data\s*:|\b(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/))/i.test(normalized);
};

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

export async function createJobFunction(form: FormData) {
  const user = await requirePermission("people.manage");
  const row = await db.jobFunction.create({ data: { name: text(form, "name") } });
  await audit(user.userId, "CREATE", "JobFunction", row.id); revalidatePath("/pessoas");
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

export async function saveTheme(theme: string) {
  const user = await requireUser();
  if (!isThemeName(theme)) throw new Error("Tema inválido.");
  await db.user.update({ where: { id: user.userId }, data: { theme } });
  await audit(user.userId, "UPDATE_THEME", "User", user.userId, { theme });
  revalidatePath("/", "layout");
}

const revalidateHelp = () => {
  revalidatePath("/ajuda");
  revalidatePath("/", "layout");
};

export async function saveHelpGuide(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = optional(form, "id");
  const pageKey = text(form, "pageKey");
  if (!isHelpPage(pageKey)) throw new Error("Página do manual inválida.");
  const title = text(form, "title");
  if (!title) throw new Error("Informe o título do manual.");
  const existing = await db.helpGuide.findUnique({ where: { pageKey }, select: { id: true } });
  if (existing && existing.id !== id) throw new Error("Já existe um manual para esta página.");
  const data = { pageKey, title, active: text(form, "active") === "true" };
  const guide = id ? await db.helpGuide.update({ where: { id }, data }) : await db.helpGuide.create({ data: { ...data, active: true } });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "HelpGuide", guide.id);
  revalidateHelp();
  return guide.id;
}

export async function deleteHelpGuide(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = text(form, "id");
  await db.helpGuide.delete({ where: { id } });
  await audit(user.userId, "DELETE", "HelpGuide", id);
  revalidateHelp();
}

export async function saveHelpStep(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = optional(form, "id");
  const guideId = text(form, "guideId");
  const title = text(form, "title"), content = text(form, "content");
  if (!title || !content) throw new Error("Informe o título e o texto do passo.");
  await db.helpGuide.findUniqueOrThrow({ where: { id: guideId }, select: { id: true } });
  const files = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > HELP_IMAGES_PER_STEP_MAX) throw new Error("Envie no máximo quatro imagens por passo.");
  for (const file of files) {
    if (!REPORT_IMAGE_TYPES.has(file.type)) throw new Error("As imagens devem estar em PNG, JPEG ou WebP.");
    if (file.size > HELP_IMAGE_MAX_BYTES) throw new Error("Cada imagem deve ter no máximo 3 MB.");
  }
  const step = await db.$transaction(async (tx) => {
    const current = id ? await tx.helpStep.findFirst({ where: { id, guideId } }) : null;
    if (id && !current) throw new Error("Passo de ajuda inválido.");
    const position = current?.position || ((await tx.helpStep.aggregate({ where: { guideId }, _max: { position: true } }))._max.position || 0) + 1;
    const saved = current
      ? await tx.helpStep.update({ where: { id: current.id }, data: { title, content } })
      : await tx.helpStep.create({ data: { guideId, position, title, content } });
    if (files.length > 0) {
      const maxImagePosition = (await tx.helpStepImage.aggregate({ where: { stepId: saved.id }, _max: { position: true } }))._max.position || 0;
      await tx.helpStepImage.createMany({ data: await Promise.all(files.map(async (file, index) => ({
        stepId: saved.id, position: maxImagePosition + index + 1, data: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type, fileName: file.name.slice(0, 255),
      }))) });
    }
    return saved;
  });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "HelpStep", step.id);
  revalidateHelp();
  return step.id;
}

export async function deleteHelpStep(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = text(form, "id");
  await db.helpStep.delete({ where: { id } });
  await audit(user.userId, "DELETE", "HelpStep", id);
  revalidateHelp();
}

export async function deleteHelpStepImage(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = text(form, "id");
  await db.helpStepImage.delete({ where: { id } });
  await audit(user.userId, "DELETE", "HelpStepImage", id);
  revalidateHelp();
}

export async function moveHelpStep(form: FormData) {
  const user = await requirePermission("help.manage");
  const id = text(form, "id"), direction = text(form, "direction");
  if (direction !== "up" && direction !== "down") throw new Error("Direção inválida.");
  const step = await db.helpStep.findUniqueOrThrow({ where: { id } });
  const neighbor = await db.helpStep.findFirst({
    where: { guideId: step.guideId, position: direction === "up" ? { lt: step.position } : { gt: step.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await db.$transaction([
    db.helpStep.update({ where: { id: step.id }, data: { position: -1 } }),
    db.helpStep.update({ where: { id: neighbor.id }, data: { position: step.position } }),
    db.helpStep.update({ where: { id: step.id }, data: { position: neighbor.position } }),
  ]);
  await audit(user.userId, "REORDER", "HelpStep", id);
  revalidateHelp();
}

export async function savePerson(form: FormData) {
  const user = await requirePermission("people.manage");
  const id = optional(form, "id");
  const data = {
    name: text(form, "name"), cpf: optional(form, "cpf"), phone: optional(form, "phone"),
    email: optional(form, "email"), jobFunctionId: optional(form, "jobFunctionId"),
    type: text(form, "type") as "EMPLOYEE" | "CONTRACTOR" | "OTHER", notes: optional(form, "notes"),
  };
  const row = id
    ? await db.person.update({ where: { id }, data })
    : await db.person.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Person", row.id);
  revalidatePath("/pessoas");
}

export async function saveCompany(form: FormData) {
  const user = await requirePermission("companies.manage");
  const id = optional(form, "id");
  const data = {
    name: text(form, "name"), document: optional(form, "document"),
    isFuelSupplier: form.get("isFuelSupplier") === "true",
    active: id ? text(form, "active") === "true" : true,
  };
  const row = id ? await db.company.update({ where: { id }, data }) : await db.company.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Company", row.id);
  ["/empresas", "/obras", "/combustivel"].forEach((path) => revalidatePath(path));
}

export async function saveSystemSettings(form: FormData) {
  const user = await requirePermission("settings.manage");
  const requiredFields = ["legalName", "cnpj", "address", "phone", "responsibleName", "responsiblePhone"];
  if (requiredFields.some((field) => !text(form, field))) throw new Error("Preencha todos os dados da empresa.");
  const cnpj = text(form, "cnpj");
  if (cnpj.replace(/\D/g, "").length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");

  const image = form.get("reportImage");
  const removeImage = form.get("removeImage") === "true";
  let imageData: { reportImage: Uint8Array; reportImageMimeType: string; reportImageFileName: string } | null = null;
  if (image instanceof File && image.size > 0) {
    if (removeImage) throw new Error("Escolha entre enviar uma nova imagem ou remover a imagem atual.");
    const imageType = image.type === "image/svg+xml" || image.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : image.type;
    if (!REPORT_IMAGE_TYPES.has(imageType)) throw new Error("A imagem deve estar em PNG, JPEG, WebP ou SVG.");
    if (image.size > REPORT_IMAGE_MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");
    const reportImage = new Uint8Array(await image.arrayBuffer());
    if (imageType === "image/svg+xml" && !isSafeSvg(new TextDecoder().decode(reportImage))) throw new Error("O SVG contém conteúdo não permitido. Use apenas formas, textos e imagens sem scripts ou referências externas.");
    imageData = {
      reportImage,
      reportImageMimeType: imageType,
      reportImageFileName: image.name.slice(0, 255),
    };
  }

  const data = {
    legalName: text(form, "legalName"), cnpj, address: text(form, "address"),
    phone: text(form, "phone"), responsibleName: text(form, "responsibleName"),
    responsiblePhone: text(form, "responsiblePhone"),
    ...(removeImage ? { reportImage: null, reportImageMimeType: null, reportImageFileName: null } : imageData || {}),
  };
  const row = await db.systemSettings.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  await audit(user.userId, "UPDATE", "SystemSettings", row.id, { imageUpdated: Boolean(imageData), imageRemoved: removeImage });
  revalidatePath("/configuracoes");
  revalidatePath("/api/configuracoes/imagem-relatorio");
  revalidatePath("/", "layout");
}

export async function saveUser(form: FormData) {
  const user = await requirePermission("users.manage");
  const id = optional(form, "id");
  const roleId = text(form, "roleId");
  const password = text(form, "password");
  if (!id && password.length < 8) throw new Error("A senha inicial deve ter pelo menos 8 caracteres.");
  if (id && password && password.length < 8) throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
  const passwordHash = password ? await hash(password, 12) : null;
  const data = {
    name: text(form, "name"), email: text(form, "email").toLowerCase(),
    personId: optional(form, "personId"), ...(passwordHash ? { passwordHash } : {}),
  };
  const row = await db.$transaction(async (tx) => {
    if (!id) return tx.user.create({ data: { ...data, passwordHash: passwordHash!, roles: { create: { roleId } } } });
    const updated = await tx.user.update({ where: { id }, data });
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.userRole.create({ data: { userId: id, roleId } });
    return updated;
  });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "User", row.id);
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

export async function saveWork(form: FormData) {
  const user = await requirePermission("works.manage");
  const id = optional(form, "id");
  const data = {
    name: text(form, "name"), companyId: optional(form, "companyId"),
    description: optional(form, "description"), startDate: text(form, "startDate") ? when(form, "startDate") : null,
  };
  const row = id
    ? await db.work.update({ where: { id }, data })
    : await db.work.create({ data: { ...data, periods: { create: { competence: monthStart(businessToday()) } } } });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Work", row.id);
  ["/obras", "/", "/lancamentos", "/fechamentos", "/combustivel", "/almoxarifado", "/manutencao"].forEach((path) => revalidatePath(path));
}

export async function createEquipmentType(form: FormData) {
  const user = await requirePermission("assets.manage");
  const id = optional(form, "id");
  const row = id
    ? await db.equipmentType.update({ where: { id }, data: { name: text(form, "name") } })
    : await db.equipmentType.create({ data: { name: text(form, "name") } });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "EquipmentType", row.id);
  revalidatePath("/equipamentos");
}

export async function saveAsset(form: FormData) {
  const user = await requirePermission("assets.manage");
  const id = optional(form, "id");
  const fuelTypeId = optional(form, "fuelTypeId");
  const fuelTankCapacity = text(form, "fuelTankCapacity") ? decimal(form, "fuelTankCapacity") : null;
  const consumptionMetric = optional(form, "consumptionMetric") as "LITERS_PER_HOUR" | "KM_PER_LITER" | null;
  if ((fuelTankCapacity || consumptionMetric) && (!fuelTypeId || !fuelTankCapacity || fuelTankCapacity.lte(0) || !consumptionMetric)) throw new Error("Informe combustível, capacidade do tanque e método de consumo.");
  const data = {
    equipmentTypeId: text(form, "equipmentTypeId"),
    identifier: text(form, "identifier").toUpperCase().replace(/[^A-Z0-9-]/g, ""),
    description: text(form, "description"), brand: optional(form, "brand"), model: optional(form, "model"),
    fuelTypeId, fuelTankCapacity, consumptionMetric, expectedUsage: text(form, "expectedUsage") ? decimal(form, "expectedUsage") : null,
  };
  const row = id ? await db.asset.update({ where: { id }, data }) : await db.asset.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Asset", row.id);
  ["/equipamentos", "/lancamentos", "/combustivel", "/manutencao"].forEach((path) => revalidatePath(path));
}

export async function saveAccount(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const id = optional(form, "id");
  const parentId = optional(form, "parentId");
  if (parentId) {
    const accounts = await db.account.findMany({ select: { id: true, parentId: true, analytic: true } });
    const parent = accounts.find((account) => account.id === parentId);
    if (!parent || parent.analytic) throw new Error("A conta superior deve ser sintética.");
    const parents = new Map(accounts.map((account) => [account.id, account.parentId]));
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) throw new Error("Uma conta não pode pertencer a ela mesma ou a uma de suas contas descendentes.");
      cursor = parents.get(cursor) || null;
    }
  }
  const row = id
    ? await db.account.update({ where: { id }, data: { name: text(form, "name"), parentId } })
    : await db.account.create({ data: {
      code: text(form, "code"), name: text(form, "name"),
      nature: text(form, "nature") as "DEBIT" | "CREDIT", analytic: text(form, "analytic") === "true",
      parentId,
    }});
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Account", row.id);
  if (!id && row.analytic && parentId) {
    const [parent, clients] = await Promise.all([
      db.account.findUnique({ where: { id: parentId }, select: { code: true } }),
      db.account.findUnique({ where: { code: "1.2" }, select: { id: true } }),
    ]);
    if (parent && clients && ["3.1", "3.2"].includes(parent.code)) {
      const entryType = await db.entryType.upsert({
        where: { name: row.name }, update: {},
        create: { name: row.name, defaultDebitAccountId: clients.id, defaultCreditAccountId: row.id },
      });
      await audit(user.userId, "ENSURE_AUTO", "EntryType", entryType.id, { sourceAccountId: row.id });
    }
  }
  revalidatePath("/plano-contas");
  revalidatePath("/tipos-lancamento");
  revalidatePath("/lancamentos");
  revalidatePath("/combustivel"); revalidatePath("/combustivel/compras"); revalidatePath("/combustivel/abastecimentos"); revalidatePath("/tipos-combustiveis");
  redirect("/plano-contas");
}

export async function saveEntryType(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const id = optional(form, "id");
  const defaultDebitAccountId = text(form, "defaultDebitAccountId");
  const defaultCreditAccountId = text(form, "defaultCreditAccountId");
  const validAccounts = await db.account.count({ where: {
    id: { in: [defaultDebitAccountId, defaultCreditAccountId] }, active: true, analytic: true,
  }});
  if (validAccounts !== 2 || defaultDebitAccountId === defaultCreditAccountId) {
    throw new Error("Selecione duas contas analíticas ativas e distintas.");
  }
  const data = {
    name: text(form, "name"), defaultDebitAccountId, defaultCreditAccountId,
    active: id ? text(form, "active") === "true" : true,
    requiresAsset: form.get("requiresAsset") === "true",
    requiresPerson: form.get("requiresPerson") === "true",
    forFuelDispense: form.get("forFuelDispense") === "true",
  };
  const row = id
    ? await db.entryType.update({ where: { id }, data })
    : await db.entryType.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "EntryType", row.id);
  revalidatePath("/tipos-lancamento");
  revalidatePath("/lancamentos");
  revalidatePath("/combustivel/abastecimentos");
}

export async function deleteEntryType(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const id = text(form, "id");
  const used = await db.accountingEntry.count({ where: { entryTypeId: id } });
  if (used) await db.entryType.update({ where: { id }, data: { active: false } });
  else await db.entryType.delete({ where: { id } });
  await audit(user.userId, used ? "DEACTIVATE" : "DELETE", "EntryType", id);
  revalidatePath("/tipos-lancamento");
  revalidatePath("/lancamentos");
}

async function assertOpen(workId: string, date: Date) {
  const today = businessToday();
  const currentCompetence = monthStart(today);
  const competence = monthStart(date);
  if (date > today) throw new Error("Não é permitido lançar em data futura.");

  const openPeriod = await db.accountingPeriod.findFirst({
    where: { workId, status: "OPEN" }, orderBy: { competence: "asc" },
  });
  if (openPeriod && openPeriod.competence < currentCompetence) {
    throw new Error("A competência anterior venceu. Feche-a antes de realizar novos lançamentos.");
  }
  if (openPeriod && openPeriod.competence.getTime() !== competence.getTime()) {
    throw new Error("A data deve pertencer à competência vigente da obra.");
  }
  if (!openPeriod) {
    if (competence.getTime() !== currentCompetence.getTime()) {
      throw new Error("A data deve pertencer ao mês vigente.");
    }
    const period = await db.accountingPeriod.findUnique({ where: { workId_competence: { workId, competence } } });
    if (period?.status === "CLOSED") throw new Error("Esta competência está fechada.");
    if (!period) await db.accountingPeriod.create({ data: { workId, competence } });
  }
  return competence;
}

export async function saveEntry(form: FormData) {
  const user = await requirePermission("accounting.manage");
  const id = optional(form, "id");
  const workId = text(form, "workId");
  const date = when(form, "date");
  if (id) {
    const existing = await db.accountingEntry.findUniqueOrThrow({
      where: { id }, select: { workId: true, date: true, fuelPurchase: { select: { id: true } }, fuelDispense: { select: { id: true } }, supplierLedgerEntry: { select: { id: true } }, fuelMeasurement: { select: { id: true } } },
    });
    if (existing.fuelPurchase) throw new Error("Compras de combustível não podem ser alteradas pelo Centro de custos.");
    if (existing.fuelDispense) throw new Error("Abastecimentos não podem ser alterados pelo Centro de custos.");
    if (existing.supplierLedgerEntry) throw new Error("Pagamentos de fornecedores não podem ser alterados pelo Centro de custos.");
    if (existing.fuelMeasurement) throw new Error("Medições de combustível não podem ser alteradas pelo Centro de custos.");
    if (!existing.workId) throw new Error("Lançamentos financeiros automáticos não podem ser alterados pelo Centro de custos.");
    await assertOpen(existing.workId, existing.date);
  }
  const entryTypeId = text(form, "entryTypeId");
  const entryType = await db.entryType.findFirst({ where: { id: entryTypeId, active: true }, select: { id: true, requiresAsset: true, requiresPerson: true } });
  if (!entryType) throw new Error("Selecione um tipo de lançamento ativo.");
  const competence = await assertOpen(workId, date);
  const amount = decimal(form, "amount");
  const debitAccountId = text(form, "debitAccountId");
  const creditAccountId = text(form, "creditAccountId");
  if (amount.lte(0) || debitAccountId === creditAccountId) throw new Error("Valor e contas do lançamento são inválidos.");
  const accounts = await db.account.count({ where: { id: { in: [debitAccountId, creditAccountId] }, active: true, analytic: true } });
  if (accounts !== 2) throw new Error("Use duas contas analíticas ativas.");
  const assetId = optional(form, "assetId");
  const personId = optional(form, "personId");
  if (entryType.requiresAsset && !assetId) throw new Error("Este tipo de lançamento exige um equipamento.");
  if (entryType.requiresPerson && !personId) throw new Error("Este tipo de lançamento exige um operador/motorista.");
  const [assetCount, personCount] = await Promise.all([
    assetId ? db.asset.count({ where: { id: assetId, active: true } }) : 1,
    personId ? db.person.count({ where: { id: personId, active: true } }) : 1,
  ]);
  if (assetCount !== 1 || personCount !== 1) throw new Error("Selecione equipamento e operador/motorista ativos.");
  const meterStartValue = optional(form, "meterStart");
  const meterEndValue = optional(form, "meterEnd");
  if (Boolean(meterStartValue) !== Boolean(meterEndValue)) throw new Error("Informe o horímetro/odômetro inicial e final.");
  if ((meterStartValue || meterEndValue) && !assetId) throw new Error("Selecione um equipamento para informar o horímetro/odômetro.");
  const meterStart = meterStartValue ? new Prisma.Decimal(meterStartValue.replace(",", ".")) : null;
  const meterEnd = meterEndValue ? new Prisma.Decimal(meterEndValue.replace(",", ".")) : null;
  if (meterStart?.lt(0) || meterEnd?.lt(0) || (meterStart && meterEnd && meterEnd.lt(meterStart))) {
    throw new Error("O horímetro/odômetro informado é inválido.");
  }
  let startAt: Date | null = null, endAt: Date | null = null;
  let secondStartAt: Date | null = null, secondEndAt: Date | null = null;
  let hours: Prisma.Decimal | null = null;
  const startTime = text(form, "startTime"); const endTime = text(form, "endTime");
  const secondStartTime = text(form, "secondStartTime"); const secondEndTime = text(form, "secondEndTime");
  if (Boolean(startTime) !== Boolean(endTime)) throw new Error("Informe as horas inicial e final.");
  if (Boolean(secondStartTime) !== Boolean(secondEndTime)) throw new Error("Informe as horas inicial e final do segundo período.");
  if (secondStartTime && !startTime) throw new Error("Informe o primeiro período antes do segundo.");
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  let elapsedMilliseconds = 0;
  if (startTime && endTime) {
    if (!validTime(startTime) || !validTime(endTime)) throw new Error("Informe horas válidas no primeiro período.");
    const day = text(form, "date");
    startAt = new Date(`${day}T${startTime}:00-03:00`); endAt = new Date(`${day}T${endTime}:00-03:00`);
    if (endAt <= startAt) throw new Error("A hora final deve ser posterior à inicial.");
    elapsedMilliseconds += endAt.getTime() - startAt.getTime();
  }
  if (secondStartTime && secondEndTime) {
    if (!validTime(secondStartTime) || !validTime(secondEndTime)) throw new Error("Informe horas válidas no segundo período.");
    const day = text(form, "date");
    secondStartAt = new Date(`${day}T${secondStartTime}:00-03:00`); secondEndAt = new Date(`${day}T${secondEndTime}:00-03:00`);
    if (secondEndAt <= secondStartAt) throw new Error("A hora final do segundo período deve ser posterior à inicial.");
    if (endAt && secondStartAt < endAt) throw new Error("O segundo período deve começar após o término do primeiro.");
    elapsedMilliseconds += secondEndAt.getTime() - secondStartAt.getTime();
  }
  if (elapsedMilliseconds > 0) hours = new Prisma.Decimal(elapsedMilliseconds / 3_600_000);
  const data = {
    date, competence, history: text(form, "history"), document: optional(form, "document"), workId,
    personId, assetId, entryTypeId,
    startAt, endAt, secondStartAt, secondEndAt, hours, meterStart, meterEnd,
    lines: { create: [
      { accountId: debitAccountId, debit: amount, credit: 0 },
      { accountId: creditAccountId, debit: 0, credit: amount },
    ] },
  };
  const row = id
    ? await db.accountingEntry.update({ where: { id }, data: { ...data, lines: { deleteMany: {}, create: data.lines.create } } })
    : await db.accountingEntry.create({ data: { ...data, createdById: user.userId } });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "AccountingEntry", row.id);
  revalidatePath("/lancamentos"); revalidatePath("/");
}

export async function closePeriod(form: FormData) {
  const user = await requirePermission("closing.close");
  const periodId = text(form, "periodId");
  const period = periodId
    ? await db.accountingPeriod.findUniqueOrThrow({ where: { id: periodId } })
    : await db.accountingPeriod.findUniqueOrThrow({ where: { workId_competence: { workId: text(form, "workId"), competence: monthStart(`${text(form, "competence")}-01`) } } });
  const workId = period.workId;
  const competence = period.competence;
  const currentCompetence = monthStart(businessToday());
  if (period.status !== "OPEN" || competence >= currentCompetence) throw new Error("Somente uma competência vencida e aberta pode ser fechada.");
  const earliest = await db.accountingPeriod.findFirst({ where: { workId, status: "OPEN" }, orderBy: { competence: "asc" } });
  if (earliest?.id !== period.id) throw new Error("Feche primeiro a competência mais antiga desta obra.");
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
    const otherOverdue = await tx.accountingPeriod.count({ where: { workId, status: "OPEN", competence: { lt: currentCompetence } } });
    if (otherOverdue === 0) {
      const current = await tx.accountingPeriod.findUnique({ where: { workId_competence: { workId, competence: currentCompetence } } });
      if (!current) await tx.accountingPeriod.create({ data: { workId, competence: currentCompetence } });
      else if (current.status === "CLOSED") throw new Error("A competência do mês vigente já está fechada.");
    }
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

export async function saveFuelType(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = optional(form, "id");
  const data = {
    name: text(form, "name"),
    referencePrice: text(form, "referencePrice") ? decimal(form, "referencePrice") : null,
    active: id ? text(form, "active") === "true" : true,
  };
  const row = id
    ? await db.fuelType.update({ where: { id }, data })
    : await db.fuelType.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "FuelType", row.id);
  revalidatePath("/combustivel");
  revalidatePath("/tipos-combustiveis");
  revalidatePath("/tanques-combustivel");
  revalidatePath("/combustivel/compras");
  revalidatePath("/combustivel/abastecimentos");
  revalidatePath("/equipamentos");
}

export async function deleteFuelType(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const [assets, purchases, dispenses, tanks] = await Promise.all([
    db.asset.count({ where: { fuelTypeId: id } }),
    db.fuelPurchase.count({ where: { fuelTypeId: id } }),
    db.fuelDispense.count({ where: { fuelTypeId: id } }),
    db.fuelTank.count({ where: { fuelTypeId: id } }),
  ]);
  const referenced = assets + purchases + dispenses + tanks > 0;
  if (referenced) await db.fuelType.update({ where: { id }, data: { active: false } });
  else await db.fuelType.delete({ where: { id } });
  await audit(user.userId, referenced ? "DEACTIVATE" : "DELETE", "FuelType", id);
  revalidatePath("/combustivel");
  revalidatePath("/tipos-combustiveis");
  revalidatePath("/tanques-combustivel");
  revalidatePath("/combustivel/compras");
  revalidatePath("/combustivel/abastecimentos");
  revalidatePath("/equipamentos");
}

export async function saveFuelTank(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = optional(form, "id");
  const capacity = decimal(form, "capacity");
  if (capacity.lte(0)) throw new Error("A capacidade do tanque deve ser maior que zero.");
  const data = {
    name: text(form, "name"), kind: text(form, "kind") as "FIXED" | "MOBILE", capacity,
    fuelTypeId: text(form, "fuelTypeId"), notes: optional(form, "notes"), active: id ? text(form, "active") === "true" : true,
  };
  if (id) {
    const current = await db.fuelTank.findUniqueOrThrow({ where: { id }, select: { fuelTypeId: true } });
    const [purchases, dispenses] = await Promise.all([
      db.fuelPurchase.aggregate({ where: { tankId: id }, _sum: { liters: true } }),
      db.fuelDispense.aggregate({ where: { tankId: id }, _sum: { liters: true } }),
    ]);
    const balance = (purchases._sum.liters ?? new Prisma.Decimal(0)).minus(dispenses._sum.liters ?? 0);
    if (capacity.lt(balance)) throw new Error("A capacidade não pode ser menor que o saldo atual do tanque.");
    if ((Number(purchases._sum.liters || 0) > 0 || Number(dispenses._sum.liters || 0) > 0) && current.fuelTypeId !== data.fuelTypeId) throw new Error("O combustível não pode ser alterado depois que o tanque possui movimentações.");
  }
  const row = id ? await db.fuelTank.update({ where: { id }, data }) : await db.fuelTank.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "FuelTank", row.id);
  revalidatePath("/tanques-combustivel"); revalidatePath("/combustivel/compras"); revalidatePath("/combustivel/abastecimentos");
}

export async function deleteFuelTank(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const referenced = await db.fuelPurchase.count({ where: { tankId: id } }) + await db.fuelDispense.count({ where: { tankId: id } });
  if (referenced) await db.fuelTank.update({ where: { id }, data: { active: false } });
  else await db.fuelTank.delete({ where: { id } });
  await audit(user.userId, referenced ? "DEACTIVATE" : "DELETE", "FuelTank", id);
  revalidatePath("/tanques-combustivel"); revalidatePath("/combustivel/compras"); revalidatePath("/combustivel/abastecimentos");
}

async function reallocateSupplierPayments(tx: Prisma.TransactionClient, supplierId: string) {
  await tx.supplierPaymentAllocation.deleteMany({ where: { payment: { supplierId } } });
  const entries = await tx.supplierLedgerEntry.findMany({ where: { supplierId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const payables = entries.filter((entry) => entry.credit.gt(0)).map((entry) => ({ entry, outstanding: entry.credit }));
  for (const payment of entries.filter((entry) => entry.debit.gt(0))) {
    let remaining = payment.debit;
    const eligible = payables.filter((payable) => payable.entry.date <= payment.date && payable.outstanding.gt(0)).sort((left, right) =>
      (left.entry.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.entry.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
      || left.entry.date.getTime() - right.entry.date.getTime() || left.entry.createdAt.getTime() - right.entry.createdAt.getTime());
    for (const payable of eligible) {
      if (remaining.lte(0)) break;
      const allocated = Prisma.Decimal.min(remaining, payable.outstanding);
      await tx.supplierPaymentAllocation.create({ data: { paymentId: payment.id, payableId: payable.entry.id, amount: allocated } });
      payable.outstanding = payable.outstanding.minus(allocated);
      remaining = remaining.minus(allocated);
    }
    if (remaining.gt(0)) throw new Error("Há pagamento sem dívida anterior suficiente para alocação.");
  }
}

export async function createFuelPurchase(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const date = when(form, "date");
  if (date > businessToday()) throw new Error("Não é permitido lançar em data futura.");
  const tankId = text(form, "tankId");
  const tank = await db.fuelTank.findFirst({ where: { id: tankId, active: true, fuelType: { active: true } }, select: { id: true, fuelTypeId: true, capacity: true } });
  if (!tank) throw new Error("Selecione um tanque ativo.");
  const fuelTypeId = tank.fuelTypeId;
  const liters = decimal(form, "liters"); const unitPrice = decimal(form, "unitPrice"); const total = liters.mul(unitPrice).toDecimalPlaces(2);
  if (liters.lte(0) || unitPrice.lte(0)) throw new Error("Quantidade e preço devem ser maiores que zero.");
  const supplierId = text(form, "supplierId"); const coupon = text(form, "coupon");
  const paymentTerm = text(form, "paymentTerm") as "CASH" | "CREDIT";
  if (!(["CASH", "CREDIT"] as const).includes(paymentTerm)) throw new Error("Forma de pagamento inválida.");
  const dueDate = paymentTerm === "CREDIT" ? when(form, "dueDate") : null;
  if (paymentTerm === "CREDIT" && !text(form, "dueDate")) throw new Error("Informe o vencimento da compra a prazo.");
  const supplier = await db.company.findFirst({ where: { id: supplierId, active: true, isFuelSupplier: true }, select: { id: true } });
  if (!supplier) throw new Error("Selecione um fornecedor de combustível ativo.");
  if (await db.fuelPurchase.count({ where: { supplierId, coupon } })) throw new Error("Já existe uma compra deste fornecedor com o mesmo documento.");
  const row = await db.$transaction(async (tx) => {
    const accountRows = await tx.account.findMany({ where: { code: { in: ["1.1", "1.3", "2.1"] }, active: true, analytic: true } });
    const accounts = new Map(accountRows.map((account) => [account.code, account.id]));
    const debitAccountId = accounts.get("1.3");
    const creditAccountId = accounts.get(paymentTerm === "CREDIT" ? "2.1" : "1.1");
    if (!debitAccountId || !creditAccountId) throw new Error("Configure as contas 1.1, 1.3 e 2.1 antes de registrar compras.");
    const [inputs, outputs] = await Promise.all([
      tx.fuelPurchase.aggregate({ where: { tankId }, _sum: { liters: true } }),
      tx.fuelDispense.aggregate({ where: { tankId }, _sum: { liters: true } }),
    ]);
    const balance = (inputs._sum.liters ?? new Prisma.Decimal(0)).minus(outputs._sum.liters ?? 0);
    if (balance.plus(liters).gt(tank.capacity)) throw new Error("A compra ultrapassa a capacidade disponível do tanque.");
    const entry = await tx.accountingEntry.create({ data: {
      date, competence: monthStart(date), history: `Compra para tanque de combustível - nota ${coupon}`,
      document: coupon, createdById: user.userId,
      lines: { create: [
        { accountId: debitAccountId, debit: total, credit: 0 },
        { accountId: creditAccountId, debit: 0, credit: total },
      ] },
    }});
    const purchase = await tx.fuelPurchase.create({ data: {
      date, coupon, liters, unitPrice, total, tankId, paymentTerm,
      supplierId, fuelTypeId,
      entryId: entry.id, createdById: user.userId,
    }});
    if (paymentTerm === "CREDIT") {
      await tx.supplierLedgerEntry.create({ data: {
      date, description: `Compra de combustível - ${coupon}`, document: coupon, credit: total,
      supplierId, purchaseId: purchase.id, entryId: entry.id, dueDate, createdById: user.userId,
      }});
      await reallocateSupplierPayments(tx, supplierId);
    }
    return purchase;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CREATE", "FuelPurchase", row.id); revalidatePath("/combustivel"); revalidatePath("/combustivel/compras");
}

export async function createSupplierPayment(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const supplierId = text(form, "supplierId"); const date = when(form, "date");
  const amount = decimal(form, "amount"); const document = optional(form, "document");
  if (date > businessToday()) throw new Error("Não é permitido lançar em data futura.");
  if (amount.lte(0)) throw new Error("Informe um valor de pagamento válido.");
  const row = await db.$transaction(async (tx) => {
    const supplier = await tx.company.findFirst({ where: { id: supplierId, active: true, isFuelSupplier: true }, select: { id: true, name: true } });
    if (!supplier) throw new Error("Selecione um fornecedor ativo.");
    const accountRows = await tx.account.findMany({ where: { code: { in: ["1.1", "2.1"] }, active: true, analytic: true } });
    const accounts = new Map(accountRows.map((account) => [account.code, account.id]));
    if (!accounts.get("1.1") || !accounts.get("2.1")) throw new Error("Configure as contas 1.1 e 2.1 antes de registrar pagamentos.");
    const ledger = await tx.supplierLedgerEntry.aggregate({ where: { supplierId, date: { lte: date } }, _sum: { debit: true, credit: true } });
    const balance = (ledger._sum.credit ?? new Prisma.Decimal(0)).minus(ledger._sum.debit ?? 0);
    if (amount.gt(balance)) throw new Error("O pagamento é superior ao saldo aberto do fornecedor.");
    const entry = await tx.accountingEntry.create({ data: {
      date, competence: monthStart(date), history: `Pagamento a fornecedor de combustível - ${supplier.name}`, document,
      createdById: user.userId, lines: { create: [
        { accountId: accounts.get("2.1")!, debit: amount, credit: 0 },
        { accountId: accounts.get("1.1")!, debit: 0, credit: amount },
      ] },
    }});
    const payment = await tx.supplierLedgerEntry.create({ data: { date, description: `Pagamento - ${supplier.name}`, document, debit: amount, supplierId, entryId: entry.id, createdById: user.userId } });
    await reallocateSupplierPayments(tx, supplierId);
    return payment;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CREATE", "SupplierLedgerEntry", row.id);
  revalidatePath("/combustivel/compras"); revalidatePath("/lancamentos");
}

export async function createFuelDispense(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const operationId = randomUUID();
  const source = text(form, "source") as "INTERNAL_TANK" | "DIRECT_SUPPLIER";
  if (!["INTERNAL_TANK", "DIRECT_SUPPLIER"].includes(source)) throw new Error("Origem do abastecimento inválida.");
  const tankId = source === "INTERNAL_TANK" ? text(form, "tankId") : null;
  const supplierId = source === "DIRECT_SUPPLIER" ? text(form, "supplierId") : null;
  const fuelTypeId = text(form, "fuelTypeId");
  const liters = decimal(form, "liters"); const assetId = text(form, "assetId");
  const workId = text(form, "workId"); const date = when(form, "date"); const meter = decimal(form, "meter");
  const entryTypeId = text(form, "entryTypeId"); const personId = optional(form, "personId");
  const competence = await assertOpen(workId, date);
  const [tank, fuelType, asset, entryType, work, supplier] = await Promise.all([
    tankId ? db.fuelTank.findFirst({ where: { id: tankId, active: true }, select: { id: true, fuelTypeId: true } }) : null,
    db.fuelType.findFirst({ where: { id: fuelTypeId, active: true }, select: { id: true } }),
    db.asset.findFirst({ where: { id: assetId, active: true }, select: { id: true, identifier: true, fuelTankCapacity: true, consumptionMetric: true } }),
    db.entryType.findFirst({ where: { id: entryTypeId, active: true, forFuelDispense: true }, select: { id: true, requiresPerson: true } }),
    db.work.findFirst({ where: { id: workId, active: true }, select: { id: true, companyId: true } }),
    supplierId ? db.company.findFirst({ where: { id: supplierId, active: true, isFuelSupplier: true }, select: { id: true, name: true } }) : null,
  ]);
  if (!work) throw new Error("Selecione uma obra ativa.");
  if (source === "INTERNAL_TANK" && !tank) throw new Error("Selecione um tanque ativo.");
  if (source === "DIRECT_SUPPLIER" && !supplier) throw new Error("Selecione um fornecedor ativo.");
  if (!fuelType) throw new Error("Selecione um combustível ativo.");
  if (!asset) throw new Error("Selecione um equipamento ativo.");
  if (tank && tank.fuelTypeId !== fuelType.id) throw new Error("O combustível selecionado não corresponde ao tanque interno.");
  if (!asset.fuelTankCapacity || !asset.consumptionMetric) throw new Error("Configure a capacidade do tanque e o cálculo de consumo do equipamento.");
  if (liters.lte(0) || liters.gt(asset.fuelTankCapacity)) throw new Error("A quantidade abastecida é inválida ou supera a capacidade do equipamento.");
  if (meter.lt(0)) throw new Error("Horímetro/odômetro inválido.");
  if (!entryType) throw new Error("Selecione um tipo de lançamento válido para abastecimento.");
  if (entryType.requiresPerson && !personId) throw new Error("O tipo de lançamento exige operador ou motorista.");
  const paymentTerm = source === "DIRECT_SUPPLIER" ? text(form, "paymentTerm") as "CASH" | "CREDIT" : null;
  const document = source === "DIRECT_SUPPLIER" ? text(form, "document") : null;
  const unitPrice = decimal(form, "unitPrice");
  const dueDate = source === "DIRECT_SUPPLIER" && paymentTerm === "CREDIT" ? when(form, "dueDate") : null;
  if (source === "DIRECT_SUPPLIER" && !document) throw new Error("Informe o documento ou cupom do abastecimento direto.");
  if (unitPrice.lte(0)) throw new Error("Informe um preço por litro válido.");
  if (source === "DIRECT_SUPPLIER" && !(["CASH", "CREDIT"] as const).includes(paymentTerm!)) throw new Error("Forma de pagamento inválida.");
  if (source === "DIRECT_SUPPLIER" && paymentTerm === "CREDIT" && !text(form, "dueDate")) throw new Error("Informe o vencimento do abastecimento a prazo.");
  if (source === "DIRECT_SUPPLIER" && await db.fuelDispense.count({ where: { supplierId, document } })) throw new Error("Já existe um abastecimento deste fornecedor com o mesmo documento.");
  const reimbursable = Boolean(work.companyId) && form.get("reimbursable") === "true";
  const row = await db.$transaction(async (tx) => {
    const [purchases, dispenses, previous, financialAccounts] = await Promise.all([
      tankId ? tx.fuelPurchase.aggregate({ where: { tankId }, _sum: { liters: true, total: true } }) : null,
      tankId ? tx.fuelDispense.aggregate({ where: { tankId }, _sum: { liters: true, totalCost: true } }) : null,
      tx.fuelDispense.findFirst({ where: { assetId, fullTank: true, meter: { not: null } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      tx.account.findMany({ where: { code: { in: ["1.1", "1.3", "2.1", "4.1"] }, active: true, analytic: true } }),
    ]);
    const available = purchases && dispenses ? (purchases._sum.liters ?? new Prisma.Decimal(0)).minus(dispenses._sum.liters ?? 0) : null;
    if (available && liters.gt(available)) throw new Error("Saldo de combustível insuficiente no tanque selecionado.");
    if (previous && date < previous.date) throw new Error("A data não pode ser anterior ao último abastecimento completo do equipamento.");
    const meterDelta = previous?.meter ? meter.minus(previous.meter) : null;
    if (meterDelta && meterDelta.lte(0)) throw new Error("O medidor deve ser maior que o do abastecimento completo anterior.");
    const consumptionRate = meterDelta ? (asset.consumptionMetric === "LITERS_PER_HOUR" ? liters.div(meterDelta) : meterDelta.div(liters)).toDecimalPlaces(3) : null;
    const unitCost = unitPrice;
    const totalCost = unitCost.mul(liters).toDecimalPlaces(2);
    const accountMap = new Map(financialAccounts.map((account) => [account.code, account.id]));
    const debitAccountId = accountMap.get("4.1");
    const creditAccountId = accountMap.get(source === "INTERNAL_TANK" ? "1.3" : paymentTerm === "CREDIT" ? "2.1" : "1.1");
    if (!debitAccountId || !creditAccountId) throw new Error("Configure as contas 1.1, 1.3, 2.1 e 4.1 antes de registrar abastecimentos.");
    const entry = await tx.accountingEntry.create({ data: {
      operationId,
      date, competence, history: `${source === "DIRECT_SUPPLIER" ? "Abastecimento direto" : "Abastecimento do tanque"} - ${asset.identifier}`,
      document, workId, assetId, personId,
      entryTypeId, createdById: user.userId, lines: { create: [
        { operationId, accountId: debitAccountId, debit: totalCost, credit: 0 },
        { operationId, accountId: creditAccountId, debit: 0, credit: totalCost },
      ] },
    }});
    const saved = await tx.fuelDispense.create({ data: {
      operationId,
      date, liters, meter, fullTank: true, meterDelta, consumptionRate, unitCost, totalCost,
      source, document, unitPrice, paymentTerm, dueDate, reimbursable,
      reimbursementAmount: reimbursable ? totalCost : 0,
      notes: optional(form, "notes"), fuelTypeId: fuelType.id, tankId, supplierId, assetId, workId, personId,
      entryId: entry.id, createdById: user.userId,
    }});
    if (source === "DIRECT_SUPPLIER" && paymentTerm === "CREDIT") {
      await tx.supplierLedgerEntry.create({ data: {
        operationId,
        date, dueDate, description: `Abastecimento direto - ${asset.identifier}`, document, credit: totalCost,
        supplierId: supplierId!, dispenseId: saved.id, entryId: entry.id, createdById: user.userId,
      }});
      await reallocateSupplierPayments(tx, supplierId!);
    }
    return saved;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CREATE", "FuelDispense", row.id); revalidatePath("/combustivel"); revalidatePath("/combustivel/abastecimentos"); revalidatePath("/combustivel/compras");
  revalidatePath("/tanques-combustivel"); revalidatePath("/lancamentos");
  revalidatePath("/combustivel/medicoes"); revalidatePath("/relatorios/fornecedores"); revalidatePath("/relatorios/abastecimentos");
}

const fuelDispenseMessages = new Map<string, string>([
  ["Origem do abastecimento inválida.", "source"],
  ["Não é permitido lançar em data futura.", "date"],
  ["A competência anterior venceu. Feche-a antes de realizar novos lançamentos.", "workId"],
  ["A data deve pertencer à competência vigente da obra.", "date"],
  ["A data deve pertencer ao mês vigente.", "date"],
  ["Esta competência está fechada.", "workId"],
  ["Selecione uma obra ativa.", "workId"],
  ["Selecione um tanque ativo.", "tankId"],
  ["Selecione um fornecedor ativo.", "supplierId"],
  ["Selecione um combustível ativo.", "fuelTypeId"],
  ["Selecione um equipamento ativo.", "assetId"],
  ["O combustível selecionado não corresponde ao tanque interno.", "tankId"],
  ["Configure a capacidade do tanque e o cálculo de consumo do equipamento.", "assetId"],
  ["A quantidade abastecida é inválida ou supera a capacidade do equipamento.", "liters"],
  ["Horímetro/odômetro inválido.", "meter"],
  ["Selecione um tipo de lançamento válido para abastecimento.", "entryTypeId"],
  ["O tipo de lançamento exige operador ou motorista.", "personId"],
  ["Informe o documento ou cupom do abastecimento direto.", "document"],
  ["Informe um preço por litro válido.", "unitPrice"],
  ["Forma de pagamento inválida.", "paymentTerm"],
  ["Informe o vencimento do abastecimento a prazo.", "dueDate"],
  ["Já existe um abastecimento deste fornecedor com o mesmo documento.", "document"],
  ["Saldo de combustível insuficiente no tanque selecionado.", "tankId"],
  ["A data não pode ser anterior ao último abastecimento completo do equipamento.", "date"],
  ["O medidor deve ser maior que o do abastecimento completo anterior.", "meter"],
  ["Configure as contas 1.1, 1.3, 2.1 e 4.1 antes de registrar abastecimentos.", "entryTypeId"],
]);

export async function createFuelDispenseWithFeedback(form: FormData) {
  try {
    await createFuelDispense(form);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const field = fuelDispenseMessages.get(message);
    return {
      ok: false as const,
      error: field ? message : "Não foi possível registrar o abastecimento. Verifique os dados e tente novamente.",
      field: field || "form",
    };
  }
}

async function recalculateAssetConsumption(tx: Prisma.TransactionClient, assetId: string) {
  const asset = await tx.asset.findUniqueOrThrow({ where: { id: assetId }, select: { consumptionMetric: true } });
  const rows = await tx.fuelDispense.findMany({ where: { assetId, fullTank: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  let previousMeter: Prisma.Decimal | null = null;
  for (const row of rows) {
    const meterDelta = previousMeter && row.meter ? row.meter.minus(previousMeter) : null;
    if (meterDelta && meterDelta.lte(0)) throw new Error("A sequência de medidores do equipamento deve ser crescente.");
    const consumptionRate = meterDelta
      ? (asset.consumptionMetric === "LITERS_PER_HOUR" ? row.liters.div(meterDelta) : meterDelta.div(row.liters)).toDecimalPlaces(3)
      : null;
    await tx.fuelDispense.update({ where: { id: row.id }, data: { meterDelta, consumptionRate } });
    previousMeter = row.meter;
  }
}

const revalidateFuelDispense = () => {
  revalidatePath("/combustivel"); revalidatePath("/combustivel/abastecimentos"); revalidatePath("/combustivel/compras");
  revalidatePath("/tanques-combustivel"); revalidatePath("/lancamentos"); revalidatePath("/combustivel/medicoes");
  revalidatePath("/relatorios/fornecedores"); revalidatePath("/relatorios/abastecimentos"); revalidatePath("/relatorios/centro-custos");
};

export async function updateFuelDispense(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const date = when(form, "date");
  const liters = decimal(form, "liters");
  const meter = decimal(form, "meter");
  const personId = optional(form, "personId");
  const document = optional(form, "document");
  const notes = optional(form, "notes");
  const current = await db.fuelDispense.findUniqueOrThrow({ where: { id }, include: { measurement: true, asset: true } });
  await assertOpen(current.workId, current.date);
  const competence = await assertOpen(current.workId, date);
  if (current.measurement?.status === "CLOSED") throw new Error("Abastecimentos de uma medição fechada não podem ser alterados.");
  if (current.measurement && (date < current.measurement.periodStart || date > current.measurement.periodEnd)) throw new Error("A data deve permanecer dentro do período da medição em rascunho.");
  if (liters.lte(0) || !current.asset.fuelTankCapacity || liters.gt(current.asset.fuelTankCapacity)) throw new Error("A quantidade abastecida é inválida ou supera a capacidade do equipamento.");
  if (meter.lt(0)) throw new Error("Horímetro/odômetro inválido.");
  const unitPrice = decimal(form, "unitPrice");
  const totalCost = decimal(form, "totalCost");
  if (current.source === "DIRECT_SUPPLIER" && current.paymentTerm === "CREDIT" && !text(form, "dueDate")) throw new Error("Informe o vencimento do abastecimento a prazo.");
  const dueDate = current.source === "DIRECT_SUPPLIER" && current.paymentTerm === "CREDIT" ? when(form, "dueDate") : null;
  if ((current.source === "DIRECT_SUPPLIER" && !document) || unitPrice.lte(0) || totalCost.lte(0)) throw new Error("Informe documento, valor unitário e valor total válidos.");
  if (current.source === "DIRECT_SUPPLIER" && await db.fuelDispense.count({ where: { supplierId: current.supplierId, document, id: { not: id } } })) throw new Error("Já existe um abastecimento deste fornecedor com o mesmo documento.");
  await db.$transaction(async (tx) => {
    if (current.tankId) {
      const [purchases, dispenses] = await Promise.all([
        tx.fuelPurchase.aggregate({ where: { tankId: current.tankId }, _sum: { liters: true } }),
        tx.fuelDispense.aggregate({ where: { tankId: current.tankId, id: { not: id } }, _sum: { liters: true } }),
      ]);
      const available = (purchases._sum.liters ?? new Prisma.Decimal(0)).minus(dispenses._sum.liters ?? 0);
      if (liters.gt(available)) throw new Error("Saldo de combustível insuficiente no tanque selecionado.");
    }
    const unitCost = totalCost.div(liters).toDecimalPlaces(4);
    await tx.fuelDispense.update({ where: { id }, data: {
      date, liters, meter, document, notes, personId,
      dueDate, unitPrice, unitCost, totalCost,
      reimbursementAmount: current.reimbursable ? totalCost : 0,
    } });
    if (current.entryId) {
      await tx.accountingEntry.update({ where: { id: current.entryId }, data: { date, competence, document, personId } });
      await tx.accountingLine.updateMany({ where: { entryId: current.entryId, debit: { gt: 0 } }, data: { debit: totalCost } });
      await tx.accountingLine.updateMany({ where: { entryId: current.entryId, credit: { gt: 0 } }, data: { credit: totalCost } });
    }
    const ledger = await tx.supplierLedgerEntry.findUnique({ where: { dispenseId: id } });
    if (ledger) await tx.supplierLedgerEntry.update({ where: { id: ledger.id }, data: { date, dueDate, document, credit: totalCost } });
    await recalculateAssetConsumption(tx, current.assetId);
    if (current.measurementId) {
      const total = (await tx.fuelDispense.aggregate({ where: { measurementId: current.measurementId }, _sum: { reimbursementAmount: true } }))._sum.reimbursementAmount ?? new Prisma.Decimal(0);
      await tx.fuelMeasurement.update({ where: { id: current.measurementId }, data: { total } });
    }
    if (current.supplierId && ledger) await reallocateSupplierPayments(tx, current.supplierId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "UPDATE", "FuelDispense", id, { operationId: current.operationId });
  revalidateFuelDispense();
}

export async function deleteFuelDispense(form: FormData) {
  const user = await requirePermission("fuel.manage");
  if (text(form, "confirmDelete") !== "true") throw new Error("Confirme a exclusão da operação.");
  const id = text(form, "id");
  const current = await db.fuelDispense.findUniqueOrThrow({ where: { id }, include: { measurement: true } });
  await assertOpen(current.workId, current.date);
  if (current.measurement?.status === "CLOSED") throw new Error("Abastecimentos de uma medição fechada não podem ser excluídos.");
  await db.$transaction(async (tx) => {
    const ledger = await tx.supplierLedgerEntry.findUnique({ where: { dispenseId: id } });
    if (ledger) {
      await tx.supplierPaymentAllocation.deleteMany({ where: { OR: [{ payableId: ledger.id }, { paymentId: ledger.id }] } });
      await tx.supplierLedgerEntry.delete({ where: { id: ledger.id } });
    }
    await tx.fuelDispense.delete({ where: { id } });
    if (current.entryId) await tx.accountingEntry.delete({ where: { id: current.entryId } });
    await recalculateAssetConsumption(tx, current.assetId);
    if (current.measurementId) {
      const total = (await tx.fuelDispense.aggregate({ where: { measurementId: current.measurementId }, _sum: { reimbursementAmount: true } }))._sum.reimbursementAmount ?? new Prisma.Decimal(0);
      await tx.fuelMeasurement.update({ where: { id: current.measurementId }, data: { total } });
    }
    if (current.supplierId && ledger) await reallocateSupplierPayments(tx, current.supplierId);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "DELETE", "FuelDispense", id, { operationId: current.operationId });
  revalidateFuelDispense();
}

const measurementPeriod = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("Competência inválida.");
  const [year, month] = value.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 12));
  const next = new Date(Date.UTC(year, month, 1, 12));
  const end = new Date(Date.UTC(year, month, 0, 12));
  return { competence: monthStart(start), start, next, end };
};

export async function createFuelMeasurement(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const workId = text(form, "workId");
  const period = measurementPeriod(text(form, "competence"));
  const notes = optional(form, "notes");
  const measurement = await db.$transaction(async (tx) => {
    const work = await tx.work.findFirst({ where: { id: workId, active: true, companyId: { not: null } }, select: { id: true, companyId: true } });
    if (!work?.companyId) throw new Error("A medição exige uma obra vinculada a um cliente.");
    const existing = await tx.fuelMeasurement.findUnique({ where: { workId_competence: { workId, competence: period.competence } } });
    if (existing && existing.status !== "CANCELED") throw new Error("Já existe uma medição para esta obra e competência.");
    const row = existing
      ? await tx.fuelMeasurement.update({ where: { id: existing.id }, data: { status: "DRAFT", notes, total: 0, entryId: null, closedAt: null, closedById: null } })
      : await tx.fuelMeasurement.create({ data: { workId, companyId: work.companyId, competence: period.competence, periodStart: period.start, periodEnd: period.end, notes, createdById: user.userId } });
    await tx.fuelDispense.updateMany({ where: {
      workId, reimbursable: true, measurementId: null, date: { gte: period.start, lt: period.next },
    }, data: { measurementId: row.id } });
    const total = (await tx.fuelDispense.aggregate({ where: { measurementId: row.id }, _sum: { reimbursementAmount: true } }))._sum.reimbursementAmount ?? new Prisma.Decimal(0);
    return tx.fuelMeasurement.update({ where: { id: row.id }, data: { total } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CREATE", "FuelMeasurement", measurement.id);
  revalidatePath("/combustivel/medicoes");
}

export async function refreshFuelMeasurement(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  await db.$transaction(async (tx) => {
    const measurement = await tx.fuelMeasurement.findUniqueOrThrow({ where: { id } });
    if (measurement.status !== "DRAFT") throw new Error("Somente medições em rascunho podem ser atualizadas.");
    const next = new Date(Date.UTC(measurement.competence.getUTCFullYear(), measurement.competence.getUTCMonth() + 1, 1, 12));
    await tx.fuelDispense.updateMany({ where: { workId: measurement.workId, reimbursable: true, measurementId: null, date: { gte: measurement.periodStart, lt: next } }, data: { measurementId: id } });
    const total = (await tx.fuelDispense.aggregate({ where: { measurementId: id }, _sum: { reimbursementAmount: true } }))._sum.reimbursementAmount ?? new Prisma.Decimal(0);
    await tx.fuelMeasurement.update({ where: { id }, data: { total } });
  });
  await audit(user.userId, "UPDATE", "FuelMeasurement", id);
  revalidatePath("/combustivel/medicoes");
}

export async function excludeFuelMeasurementItem(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const dispenseId = text(form, "dispenseId");
  await db.$transaction(async (tx) => {
    const measurement = await tx.fuelMeasurement.findUniqueOrThrow({ where: { id } });
    if (measurement.status !== "DRAFT") throw new Error("Somente medições em rascunho podem ser alteradas.");
    const changed = await tx.fuelDispense.updateMany({ where: { id: dispenseId, measurementId: id }, data: { measurementId: null, reimbursable: false, reimbursementAmount: 0 } });
    if (changed.count !== 1) throw new Error("Abastecimento não pertence a esta medição.");
    const total = (await tx.fuelDispense.aggregate({ where: { measurementId: id }, _sum: { reimbursementAmount: true } }))._sum.reimbursementAmount ?? new Prisma.Decimal(0);
    await tx.fuelMeasurement.update({ where: { id }, data: { total } });
  });
  await audit(user.userId, "EXCLUDE_ITEM", "FuelMeasurement", id, { dispenseId });
  revalidatePath("/combustivel/medicoes"); revalidatePath("/combustivel/abastecimentos");
}

export async function closeFuelMeasurement(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const measurement = await db.$transaction(async (tx) => {
    const current = await tx.fuelMeasurement.findUniqueOrThrow({ where: { id }, include: { dispenses: true, work: true } });
    if (current.status !== "DRAFT" || current.dispenses.length === 0) throw new Error("A medição deve estar em rascunho e possuir abastecimentos.");
    if (current.periodEnd > businessToday()) throw new Error("A medição só pode ser fechada depois do encerramento da competência.");
    const period = await tx.accountingPeriod.findUnique({ where: { workId_competence: { workId: current.workId, competence: current.competence } } });
    if (!period || period.status !== "OPEN") throw new Error("A competência da obra precisa estar aberta para fechar a medição.");
    const amount = current.dispenses.reduce((sum, dispense) => sum.plus(dispense.reimbursementAmount), new Prisma.Decimal(0));
    if (amount.lte(0)) throw new Error("A medição não possui valor reembolsável.");
    const [debit, credit, entryType] = await Promise.all([
      tx.account.findFirst({ where: { code: "1.2", active: true, analytic: true } }),
      tx.account.findFirst({ where: { code: "3.2.2", active: true, analytic: true } }),
      tx.entryType.findFirst({ where: { name: "Reembolso de combustíveis", active: true } }),
    ]);
    if (!debit || !credit) throw new Error("Configure as contas 1.2 e 3.2.2 antes de fechar medições.");
    const entryDate = current.periodEnd;
    const entry = await tx.accountingEntry.create({ data: {
      date: entryDate, competence: current.competence, history: `Medição de combustível nº ${current.number}`,
      document: `MED-${current.number}`, workId: current.workId, entryTypeId: entryType?.id, createdById: user.userId,
      lines: { create: [{ accountId: debit.id, debit: amount, credit: 0 }, { accountId: credit.id, debit: 0, credit: amount }] },
    }});
    return tx.fuelMeasurement.update({ where: { id }, data: { status: "CLOSED", total: amount, entryId: entry.id, closedById: user.userId, closedAt: new Date() } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await audit(user.userId, "CLOSE", "FuelMeasurement", measurement.id);
  revalidatePath("/combustivel/medicoes"); revalidatePath("/lancamentos"); revalidatePath("/relatorios/centro-custos");
}

export async function cancelFuelMeasurement(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  await db.$transaction(async (tx) => {
    const measurement = await tx.fuelMeasurement.findUniqueOrThrow({ where: { id } });
    if (measurement.status !== "DRAFT") throw new Error("Somente medições em rascunho podem ser canceladas.");
    await tx.fuelDispense.updateMany({ where: { measurementId: id }, data: { measurementId: null } });
    await tx.fuelMeasurement.update({ where: { id }, data: { status: "CANCELED", total: 0 } });
  });
  await audit(user.userId, "CANCEL", "FuelMeasurement", id);
  revalidatePath("/combustivel/medicoes");
}

export async function createProduct(form: FormData) {
  const user = await requirePermission("stock.manage");
  const id = optional(form, "id");
  const data = { code: text(form, "code").toUpperCase(), name: text(form, "name"), unit: text(form, "unit"), minimum: decimal(form, "minimum") };
  const row = id ? await db.product.update({ where: { id }, data }) : await db.product.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "Product", row.id); revalidatePath("/almoxarifado");
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
  const parts = Array.from({ length: 5 }, (_, index) => ({
    productId: optional(form, `partProductId${index}`),
    quantity: text(form, `partQuantity${index}`) ? decimal(form, `partQuantity${index}`) : null,
    unitCost: text(form, `partUnitCost${index}`) ? decimal(form, `partUnitCost${index}`) : new Prisma.Decimal(0),
  })).filter((part) => part.productId || part.quantity);
  if (parts.some((part) => !part.productId || !part.quantity || part.quantity.lte(0))) throw new Error("Preencha corretamente todas as peças informadas.");
  await db.$transaction(async (tx) => {
    const order = await tx.maintenanceOrder.findUnique({ where: { id }, select: { id: true, status: true, workId: true } });
    if (!order || order.status === "DONE") throw new Error("Esta ordem já foi concluída.");
    for (const part of parts) {
      const rows = await tx.stockMovement.groupBy({ by: ["kind"], where: { productId: part.productId! }, _sum: { quantity: true } });
      const balance = rows.reduce((sum, row) => sum + (row.kind === "OUT" ? -1 : 1) * Number(row._sum.quantity || 0), 0);
      if (Number(part.quantity) > balance) throw new Error("Estoque insuficiente para uma das peças.");
      await tx.stockMovement.create({ data: { date: new Date(), kind: "OUT", quantity: part.quantity!, unitCost: part.unitCost, requester: "Manutenção", history: `OS #${id}`, productId: part.productId!, workId: order.workId, createdById: user.userId } });
      await tx.maintenancePart.create({ data: { orderId: id, productId: part.productId!, quantity: part.quantity!, unitCost: part.unitCost } });
    }
    await tx.maintenanceOrder.update({ where: { id }, data: {
      status: "DONE", finishedAt: new Date(), diagnosis: optional(form, "diagnosis"), service: optional(form, "service"), externalCost: decimal(form, "externalCost"),
    } });
  });
  await audit(user.userId, "FINISH", "MaintenanceOrder", id); revalidatePath("/manutencao");
  revalidatePath("/almoxarifado");
}
