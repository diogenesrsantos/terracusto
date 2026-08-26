import { createProduct, createStockMovement } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { money, number } from "@/lib/format";
import { requirePermission } from "@/lib/auth";

export default async function StockPage() {
  await requirePermission("stock.manage");
  const [products, works, movements] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }), db.work.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.stockMovement.findMany({ include: { product: true, work: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 100 }),
  ]);
  const balances = await Promise.all(products.map(async (product) => {
    const grouped = await db.stockMovement.groupBy({ by: ["kind"], where: { productId: product.id }, _sum: { quantity: true } });
    return { ...product, balance: grouped.reduce((sum, r) => sum + (r.kind === "OUT" ? -1 : 1) * Number(r._sum.quantity || 0), 0) };
  }));
  return <><PageHead title="Almoxarifado" subtitle="Entrada por nota, requisições de saída e saldo dos produtos." />
    <section className="grid grid-2"><div className="card"><h2>Novo produto</h2><form action={createProduct} className="form-grid">
      <label className="field">Código<input name="code" required /></label><label className="field span-2">Descrição<input name="name" required /></label><label className="field">Unidade<input name="unit" placeholder="UN, L, KG" required /></label>
      <label className="field span-3">Estoque mínimo<input name="minimum" type="number" min="0" step="0.001" defaultValue="0" /></label><button className="btn">Cadastrar</button>
    </form></div><div className="card"><h2>Movimentar estoque</h2><form action={createStockMovement} className="form-grid">
      <label className="field">Data<input name="date" type="date" required /></label><label className="field">Operação<select name="kind"><option value="IN">Entrada</option><option value="OUT">Saída/requisição</option><option value="ADJUSTMENT">Ajuste positivo</option></select></label>
      <label className="field span-2">Produto<select name="productId" required><option value="">Selecione</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label>
      <label className="field">Quantidade<input name="quantity" type="number" step="0.001" min="0.001" required /></label><label className="field">Custo unitário<input name="unitCost" type="number" step="0.0001" /></label>
      <label className="field">Nota/documento<input name="document" /></label><label className="field">Solicitante<input name="requester" /></label>
      <label className="field span-2">Obra<select name="workId"><option value="">Sem vínculo</option>{works.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></label>
      <label className="field">Histórico<input name="history" required /></label><button className="btn">Registrar</button>
    </form></div></section>
    <section className="card mt"><h2>Posição do estoque</h2>{balances.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Unidade</th><th>Estoque mínimo</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{balances.map((p) => <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.unit}</td><td>{number(p.minimum,3)}</td><td><strong>{number(p.balance,3)}</strong></td><td><span className={`badge ${p.balance <= Number(p.minimum) ? "warn" : ""}`}>{p.balance <= Number(p.minimum) ? "Repor" : "Normal"}</span></td></tr>)}</tbody></table></div>}</section>
    <section className="card mt"><h2>Últimas movimentações</h2>{movements.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Data</th><th>Operação</th><th>Produto</th><th>Quantidade</th><th>Custo</th><th>Obra/solicitante</th><th>Histórico</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{m.date.toLocaleDateString("pt-BR", {timeZone:"UTC"})}</td><td>{m.kind === "IN" ? "Entrada" : m.kind === "OUT" ? "Saída" : "Ajuste"}</td><td>{m.product.name}</td><td>{number(m.quantity,3)} {m.product.unit}</td><td>{m.unitCost ? money(m.unitCost) : "—"}</td><td>{m.work?.code || "—"}<br /><small>{m.requester}</small></td><td>{m.history}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
