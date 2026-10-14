import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
const target = new URL(process.env.DATABASE_URL || "http://missing");
if (target.hostname !== "127.0.0.1" || target.port !== "18432") throw new Error("Use somente o banco temporário.");
const db = new PrismaClient();
const base = "http://127.0.0.1:18433";
try {
  const user = await db.user.findFirstOrThrow({ where: { email: { startsWith: "maintenance-" } } });
  const role = await db.role.create({ data: { name: "Teste HTTP", code: `HTTP-${Date.now()}` } });
  for (const code of ["maintenance.manage", "accounting.manage"]) {
    const p = await db.permission.upsert({ where: { code }, update: {}, create: { code, name: code } });
    await db.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
  const token = await new SignJWT({ userId: user.id, name: user.name, email: user.email }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const cookie = `terracusto_session=${token}`;
  const order = await db.maintenanceOrder.findFirstOrThrow({ where: { status: "DONE", entryId: { not: null } } });
  for (const [path, expected] of [["/manutencao", "Ordens de serviço"], ["/manutencao?status=pending", "Problema não resolvido"], ["/manutencao?status=closed", "Fechada"], [`/manutencao/${order.id}`, `Ordem de serviço nº ${order.number}`], [`/manutencao/${order.id}/relatorio`, "Serviços aplicados"], [`/lancamentos?workId=${order.workId}`, `OS-${order.number}`]]) {
    const response = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
    assert.equal(response.status, 200, path); assert.ok((await response.text()).includes(expected), `${path}: ${expected}`);
  }
  const unauthorized = await fetch(base + `/manutencao/${order.id}/relatorio`, { redirect: "manual" });
  assert.equal(unauthorized.status, 307); assert.ok(unauthorized.headers.get("location").includes("/login"));
  console.log("HTTP: listagem, filtros, detalhes, relatório, centro de custos e proteção sem sessão aprovados.");
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
