// Integration check against a disposable local PostgreSQL only. Next.js request
// context is replaced; actions and Prisma transactions run against the real DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";
const target = new URL(process.env.DATABASE_URL || "http://missing");
if (target.hostname !== "127.0.0.1" || target.port !== "18432") throw new Error("Use apenas o banco temporário em 127.0.0.1:18432.");
const db = new PrismaClient(), require = createRequire(import.meta.url);
let actor;
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const mod = { exports: {} }; cache.set(path, mod.exports);
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolve = name => {
    if (name === "@/lib/db") return { db };
    if (name === "@/lib/auth") return { requirePermission: async () => ({ userId: actor.id }) };
    if (name === "@/lib/audit") return { audit: async (userId, action, entity, entityId) => db.auditLog.create({ data: { userId, action, entity, entityId } }) };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name === "next/navigation") return { redirect(location) { const e = new Error(location); e.digest = "NEXT_REDIRECT"; throw e; } };
    if (name.startsWith("@/")) return load(new URL(`../${name.slice(2)}.ts`, import.meta.url).pathname);
    return require(name);
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { FormData, console, process, Date, Set, Map, TextEncoder })(resolve, mod, mod.exports);
  cache.set(path, mod.exports); return mod.exports;
}
const actions = load(new URL("../app/maintenance-actions.ts", import.meta.url).pathname);
const form = data => { const f = new FormData(); for (const [k, v] of Object.entries(data)) f.set(k, String(v)); return f; };
const success = async (action, data) => { const result = await actions[action](form(data)); assert.equal(result.error, "", `${action}: ${result.error}`); };
const reject = async (action, data) => assert.ok((await actions[action](form(data))).error, `${action} deveria rejeitar`);
try {
  const legacy = await db.maintenanceOrder.findUniqueOrThrow({ where: { id: "legacy-order" }, include: { parts: true } });
  assert.equal(legacy.resolved, null); assert.equal(legacy.entryId, null);
  assert.equal(legacy.parts[0].date.toISOString().slice(0, 10), "2026-09-02");
  assert.equal(legacy.parts[0].source, "STOCK"); assert.equal(Number(legacy.externalCost), 50);
  actor = await db.user.create({ data: { email: `maintenance-${Date.now()}@test.local`, name: "Teste", passwordHash: "test" } });
  const equipmentType = await db.equipmentType.create({ data: { name: `Teste ${Date.now()}` } });
  const asset = await db.asset.create({ data: { identifier: `TEST-${Date.now()}`, description: "Máquina teste", equipmentTypeId: equipmentType.id } });
  const employee = await db.person.create({ data: { name: "Funcionário teste" } });
  const group = await db.productGroup.create({ data: { name: `Teste ${Date.now()}` } });
  const product = await db.product.create({ data: { name: "Peça teste", nameNormalized: `teste-${Date.now()}`, unit: "UN", groupId: group.id, currentUnitCost: 10 } });
  await db.stockMovement.create({ data: { date: new Date(), kind: "IN", quantity: 10, unitCost: 10, history: "Estoque inicial de teste", productId: product.id, createdById: actor.id } });
  const today = load(new URL("../lib/format.ts", import.meta.url).pathname).businessToday().toISOString().slice(0, 10);
  const balance = async () => (await db.stockMovement.findMany({ where: { productId: product.id } })).reduce((s, r) => s + Number(r.quantity) * (r.kind === "OUT" ? -1 : 1), 0);
  const work = await db.work.create({ data: { name: "Obra teste" } });
  let order = await db.maintenanceOrder.create({ data: { kind: "CORRECTIVE", complaint: "Defeito teste", assetId: asset.id, workId: work.id, createdById: actor.id } });
  const base = { id: order.id, date: today };
  await success("addMaintenancePart", { ...base, source: "STOCK", productId: product.id, quantity: 2, unitCost: 12 });
  assert.equal(await balance(), 8);
  await reject("addMaintenancePart", { ...base, source: "STOCK", productId: product.id, quantity: 9, unitCost: 12 });
  assert.equal(await balance(), 8);
  await reject("addMaintenancePart", { ...base, source: "SUPPLIER", description: "Filtro", quantity: 1, unitCost: 30 });
  await success("addMaintenancePart", { ...base, source: "SUPPLIER", description: "Filtro", invoice: "NF-123", quantity: 1, unitCost: 30 });
  assert.equal(await balance(), 8);
  await success("addMaintenanceService", { ...base, employeeId: employee.id, description: "Troca do filtro", value: 50 });
  await success("finishMaintenance", { ...base, resolved: false, closingNotes: "Precisa de avaliação adicional" });
  order = await db.maintenanceOrder.findUniqueOrThrow({ where: { id: order.id }, include: { entry: { include: { lines: true, entryType: true } } } });
  assert.equal(order.status, "DONE"); assert.equal(order.resolved, false);
  assert.equal(order.entry.document, `OS-${order.number}`); assert.equal(order.entry.entryType.name, "Reembolso de Manutenção");
  assert.equal(order.entry.lines.reduce((s, l) => s + Number(l.debit), 0), 104);
  assert.equal(order.entry.lines.reduce((s, l) => s + Number(l.credit), 0), 104);
  await reject("finishMaintenance", { ...base, resolved: true, closingNotes: "Fechar novamente" });
  await reject("addMaintenanceService", { ...base, employeeId: employee.id, description: "Alteração após fechar", value: 10 });
  const draft = await db.maintenanceOrder.create({ data: { kind: "CORRECTIVE", complaint: "Excluir", assetId: asset.id, createdById: actor.id } });
  await success("addMaintenancePart", { id: draft.id, date: today, source: "STOCK", productId: product.id, quantity: 1, unitCost: 10 });
  assert.equal(await balance(), 7);
  const part = await db.maintenancePart.findFirstOrThrow({ where: { orderId: draft.id } });
  await success("removeMaintenancePart", { id: draft.id, partId: part.id }); assert.equal(await balance(), 8);
  await success("addMaintenancePart", { id: draft.id, date: today, source: "STOCK", productId: product.id, quantity: 1, unitCost: 10 });
  try { await actions.deleteMaintenance(form({ id: draft.id })); } catch (e) { assert.equal(e.digest, "NEXT_REDIRECT"); }
  assert.equal(await balance(), 8); assert.equal(await db.maintenanceOrder.count({ where: { id: draft.id } }), 0);
  const noWork = await db.maintenanceOrder.create({ data: { kind: "PREVENTIVE", complaint: "Sem obra", assetId: asset.id, createdById: actor.id } });
  await success("finishMaintenance", { id: noWork.id, date: today, resolved: true, closingNotes: "Resolvido" });
  assert.equal((await db.maintenanceOrder.findUniqueOrThrow({ where: { id: noWork.id } })).entryId, null);
  const blocked = await db.maintenanceOrder.create({ data: { kind: "CORRECTIVE", complaint: "Competência fechada", assetId: asset.id, workId: work.id, createdById: actor.id } });
  await db.accountingPeriod.updateMany({ where: { workId: work.id }, data: { status: "CLOSED" } });
  await reject("finishMaintenance", { id: blocked.id, date: today, resolved: true, closingNotes: "Tentativa bloqueada" });
  assert.equal((await db.maintenanceOrder.findUniqueOrThrow({ where: { id: blocked.id } })).status, "OPEN");
  const concurrent = await Promise.all([1, 2].map(() => db.maintenanceOrder.create({ data: { kind: "CORRECTIVE", complaint: "Concorrência", assetId: asset.id, createdById: actor.id } })));
  const results = await Promise.all(concurrent.map(o => actions.addMaintenancePart(form({ id: o.id, date: today, source: "STOCK", productId: product.id, quantity: 6, unitCost: 10 }))));
  assert.equal(results.filter(r => !r.error).length, 1); assert.equal(await balance(), 2);
  console.log("Manutenção: legado preservado, baixa imediata, saldo insuficiente, nota obrigatória, serviços, total contábil, fechamento único, competência fechada, devolução, exclusão e concorrência aprovados.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
