import { Empty, PageHead } from "@/components/page";
import { FuelTankManager } from "@/components/fuel-tank-manager";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money, number } from "@/lib/format";

export default async function FuelTanksPage() {
  await requirePermission("fuel.manage");
  const [tanks, fuels, purchases, dispenses] = await Promise.all([
    db.fuelTank.findMany({ include: { fuelType: true, purchases: { select: { liters: true } }, dispenses: { select: { liters: true } } }, orderBy: { name: "asc" } }),
    db.fuelType.findMany({ orderBy: { name: "asc" } }),
    db.fuelPurchase.findMany({ include: { tank: true, supplier: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
    db.fuelDispense.findMany({ where: { tankId: { not: null } }, include: { tank: true, asset: true, work: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  return <><PageHead title="Tanques de combustível" subtitle="Reservatórios fixos e móveis, capacidade e saldo por combustível." />
    <FuelTankManager fuels={fuels} tanks={tanks.map((tank) => ({ id: tank.id, name: tank.name, kind: tank.kind, capacity: tank.capacity.toString(), fuelTypeId: tank.fuelTypeId, fuelTypeName: tank.fuelType.name, notes: tank.notes, active: tank.active, balance: tank.purchases.reduce((sum, row) => sum + Number(row.liters), 0) - tank.dispenses.reduce((sum, row) => sum + Number(row.liters), 0) }))} />
    <section className="grid grid-2 mt"><div className="card"><h2>Entradas nos tanques</h2>{purchases.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tanque</th><th>Fornecedor/nota</th><th>Litros</th><th>Total</th></tr></thead><tbody>{purchases.map((row) => <tr key={row.id}><td>{row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{row.tank.name}</td><td>{row.supplier.name}<br /><small>{row.coupon}</small></td><td>{number(row.liters, 3)}</td><td>{money(row.total)}</td></tr>)}</tbody></table></div>}</div>
      <div className="card"><h2>Saídas dos tanques</h2>{dispenses.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Tanque</th><th>Equipamento</th><th>Obra</th><th>Litros</th></tr></thead><tbody>{dispenses.map((row) => <tr key={row.id}><td>{row.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{row.tank?.name || "—"}</td><td>{row.asset.identifier}</td><td>{row.work.code}</td><td>{number(row.liters, 3)}</td></tr>)}</tbody></table></div>}</div></section>
  </>;
}
