"use server";

import { compare, hash } from "bcryptjs";
import { Prisma, StockMovementKind } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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
const REPORT_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const REPORT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const HELP_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const HELP_IMAGES_PER_STEP_MAX = 4;

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
    if (!REPORT_IMAGE_TYPES.has(image.type)) throw new Error("A imagem deve estar em PNG, JPEG ou WebP.");
    if (image.size > REPORT_IMAGE_MAX_BYTES) throw new Error("A imagem deve ter no máximo 2 MB.");
    imageData = {
      reportImage: new Uint8Array(await image.arrayBuffer()),
      reportImageMimeType: image.type,
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
  const row = await db.equipmentType.create({ data: { name: text(form, "name") } });
  await audit(user.userId, "CREATE", "EquipmentType", row.id);
  revalidatePath("/equipamentos");
}

export async function saveAsset(form: FormData) {
  const user = await requirePermission("assets.manage");
  const id = optional(form, "id");
  const data = {
    equipmentTypeId: text(form, "equipmentTypeId"),
    identifier: text(form, "identifier").toUpperCase().replace(/[^A-Z0-9-]/g, ""),
    description: text(form, "description"), brand: optional(form, "brand"), model: optional(form, "model"),
    fuelTypeId: optional(form, "fuelTypeId"), expectedUsage: text(form, "expectedUsage") ? decimal(form, "expectedUsage") : null,
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
  revalidatePath("/combustivel");
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
  };
  const row = id
    ? await db.entryType.update({ where: { id }, data })
    : await db.entryType.create({ data });
  await audit(user.userId, id ? "UPDATE" : "CREATE", "EntryType", row.id);
  revalidatePath("/tipos-lancamento");
  revalidatePath("/lancamentos");
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
      where: { id }, select: { workId: true, date: true, fuelPurchase: { select: { id: true } } },
    });
    if (existing.fuelPurchase) throw new Error("Compras de combustível não podem ser alteradas pelo Centro de custos.");
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
    startAt, endAt, secondStartAt, secondEndAt, hours,
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
  revalidatePath("/equipamentos");
}

export async function deleteFuelType(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const id = text(form, "id");
  const [assets, purchases, dispenses] = await Promise.all([
    db.asset.count({ where: { fuelTypeId: id } }),
    db.fuelPurchase.count({ where: { fuelTypeId: id } }),
    db.fuelDispense.count({ where: { fuelTypeId: id } }),
  ]);
  const referenced = assets + purchases + dispenses > 0;
  if (referenced) await db.fuelType.update({ where: { id }, data: { active: false } });
  else await db.fuelType.delete({ where: { id } });
  await audit(user.userId, referenced ? "DEACTIVATE" : "DELETE", "FuelType", id);
  revalidatePath("/combustivel");
  revalidatePath("/equipamentos");
}

export async function createFuelPurchase(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const date = when(form, "date"); const workId = text(form, "workId");
  const competence = await assertOpen(workId, date);
  const fuelTypeId = text(form, "fuelTypeId");
  const fuelType = await db.fuelType.findFirst({ where: { id: fuelTypeId, active: true }, select: { id: true } });
  if (!fuelType) throw new Error("Selecione um combustível ativo.");
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
      supplierId: text(form, "supplierId"), fuelTypeId, workId,
      entryId: entry.id, createdById: user.userId,
    }});
  });
  await audit(user.userId, "CREATE", "FuelPurchase", row.id); revalidatePath("/combustivel");
}

export async function createFuelDispense(form: FormData) {
  const user = await requirePermission("fuel.manage");
  const fuelTypeId = text(form, "fuelTypeId"); const liters = decimal(form, "liters");
  const [fuelType, purchases, dispenses] = await Promise.all([
    db.fuelType.findFirst({ where: { id: fuelTypeId, active: true }, select: { id: true } }),
    db.fuelPurchase.aggregate({ where: { fuelTypeId }, _sum: { liters: true } }),
    db.fuelDispense.aggregate({ where: { fuelTypeId }, _sum: { liters: true } }),
  ]);
  if (!fuelType) throw new Error("Selecione um combustível ativo.");
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
