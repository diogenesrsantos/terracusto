import { PrismaClient, AccountNature } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

const permissions = [
  ["dashboard.view", "Visualizar painel"],
  ["people.manage", "Gerenciar pessoas"],
  ["users.manage", "Gerenciar usuários e acessos"],
  ["works.manage", "Gerenciar obras"],
  ["assets.manage", "Gerenciar equipamentos"],
  ["accounting.manage", "Gerenciar plano de contas e lançamentos"],
  ["closing.close", "Fechar competências"],
  ["closing.reopen", "Reabrir competências"],
  ["fuel.manage", "Gerenciar combustível"],
  ["stock.manage", "Gerenciar almoxarifado"],
  ["maintenance.manage", "Gerenciar manutenção"],
] as const;

const accounts = [
  ["1", "Ativo", AccountNature.DEBIT, false],
  ["1.1", "Caixa e bancos", AccountNature.DEBIT, true],
  ["1.2", "Clientes", AccountNature.DEBIT, true],
  ["1.3", "Estoque de combustível", AccountNature.DEBIT, true],
  ["2", "Passivo", AccountNature.CREDIT, false],
  ["2.1", "Fornecedores", AccountNature.CREDIT, true],
  ["3", "Receitas", AccountNature.CREDIT, false],
  ["3.1", "Receita de serviços", AccountNature.CREDIT, true],
  ["4", "Custos e despesas", AccountNature.DEBIT, false],
  ["4.1", "Combustíveis", AccountNature.DEBIT, true],
  ["4.2", "Manutenção", AccountNature.DEBIT, true],
  ["4.3", "Materiais", AccountNature.DEBIT, true],
  ["4.4", "Serviços de terceiros", AccountNature.DEBIT, true],
] as const;

async function main() {
  const permissionRows = [];
  for (const [code, name] of permissions) {
    permissionRows.push(await db.permission.upsert({
      where: { code }, update: { name }, create: { code, name },
    }));
  }

  const adminRole = await db.role.upsert({
    where: { code: "ADMIN" }, update: { name: "Administrador" },
    create: { code: "ADMIN", name: "Administrador" },
  });
  const clerkRole = await db.role.upsert({
    where: { code: "CLERK" }, update: { name: "Escriturário" },
    create: { code: "CLERK", name: "Escriturário" },
  });
  for (const permission of permissionRows) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {}, create: { roleId: adminRole.id, permissionId: permission.id },
    });
    if (!["users.manage", "closing.reopen"].includes(permission.code)) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: clerkRole.id, permissionId: permission.id } },
        update: {}, create: { roleId: clerkRole.id, permissionId: permission.id },
      });
    }
  }

  for (const [code, name, nature, analytic] of accounts) {
    const parentCode = code.includes(".") ? code.split(".").slice(0, -1).join(".") : null;
    const parent = parentCode ? await db.account.findUnique({ where: { code: parentCode } }) : null;
    await db.account.upsert({
      where: { code }, update: { name, nature, analytic, parentId: parent?.id },
      create: { code, name, nature, analytic, parentId: parent?.id },
    });
  }

  for (const name of ["Diesel S10", "Diesel S500", "Gasolina", "Etanol"]) {
    await db.fuelType.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of ["Operar escavadeira", "Operar retroescavadeira", "Dirigir caminhão", "Manutenção mecânica"]) {
    await db.activity.upsert({ where: { name }, update: {}, create: { name } });
  }

  const email = (process.env.ADMIN_EMAIL || "admin@terracusto.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "TerraCusto@2026";
  const user = await db.user.upsert({
    where: { email },
    update: { active: true },
    create: { name: "Administrador", email, passwordHash: await hash(password, 12) },
  });
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {}, create: { userId: user.id, roleId: adminRole.id },
  });
  console.log(`Administrador preparado: ${email}`);
}

main().finally(() => db.$disconnect());
