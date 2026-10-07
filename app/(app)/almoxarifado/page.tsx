import Link from "next/link";
import { Empty, PageHead } from "@/components/page";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";

export default async function StockPage() {
  await requirePermission("stock.manage");
  const [products, grouped, recent] = await Promise.all([db.product.findMany({ where: { active: true }, include: { group: true }, orderBy: { number: "asc" } }), db.stockMovement.groupBy({ by: ["productId", "kind"], _sum: { quantity: true } }), db.stockMovement.findMany({ include: { product: true, work: true, createdBy: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 })]);
  const balances = new Map<string, number>();
  for (const row of grouped) balances.set(row.productId, (balances.get(row.productId) || 0) + (row.kind === "OUT" ? -1 : 1) * Number(row._sum.quantity || 0));
  return <><PageHead title="Almoxarifado" subtitle="Posição atual, entradas, saídas e histórico de materiais." />
    <section className="grid grid-3 stock-links"><Link className="card action-card" href="/almoxarifado/produtos"><h2>Cadastro de produtos</h2><p>Produtos, grupos, preços atuais e vencimento.</p></Link><Link className="card action-card" href="/almoxarifado/entradas"><h2>Entradas no estoque</h2><p>Entradas por nota fiscal e atualização de custo.</p></Link><Link className="card action-card" href="/almoxarifado/saidas"><h2>Saídas do estoque</h2><p>Lista temporária, conferência e baixa contábil.</p></Link></section>
    <section className="card mt"><div className="list-head"><h2>Posição do estoque</h2><Link className="btn secondary" href="/almoxarifado/historico">Ver histórico completo</Link></div>{products.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th>Unidade</th><th>Mínimo</th><th>Saldo</th><th>Valor atual</th><th>Situação</th></tr></thead><tbody>{products.map((product) => { const balance = balances.get(product.id) || 0; return <tr key={product.id}><td>{product.number}</td><td>{product.name}</td><td>{product.group.name}</td><td>{product.unit}</td><td>{number(product.minimum, 0)}</td><td><strong>{number(balance, 0)}</strong></td><td>{product.currentUnitCost ? money(product.currentUnitCost) : "—"}</td><td><span className={`badge${balance <= Number(product.minimum) ? " warn" : ""}`}>{balance <= Number(product.minimum) ? "Repor" : "Normal"}</span></td></tr>; })}</tbody></table></div>}</section>
    <section className="card mt"><h2>Últimos movimentos</h2>{recent.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Operação</th><th>Produto</th><th>Quantidade</th><th>Valor</th><th>Obra</th><th>Usuário</th></tr></thead><tbody>{recent.map((movement) => <tr key={movement.id}><td>{movement.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td><td>{movement.kind === "IN" ? "Entrada" : movement.kind === "OUT" ? "Saída" : "Ajuste"}</td><td>{movement.product.number} — {movement.product.name}</td><td>{number(movement.quantity, 0)} {movement.product.unit}</td><td>{movement.unitCost ? money(movement.unitCost) : "—"}</td><td>{movement.work ? `${movement.work.code} — ${movement.work.name}` : "—"}</td><td>{movement.createdBy.name}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
