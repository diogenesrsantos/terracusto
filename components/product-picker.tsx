"use client";

import { useEffect, useState } from "react";
import { saveProduct, searchStockProducts } from "@/app/actions";

export type PickedProduct = { id: string; number: number; name: string; unit: string; balance: string; requiresExpiry: boolean; currentUnitCost: string };
type Group = { id: string; name: string };

export function ProductPicker({ value, onChange, groups, allowCreate = false, label = "Produto" }: { value: PickedProduct | null; onChange: (product: PickedProduct) => void; groups: Group[]; allowCreate?: boolean; label?: string }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [page, setPage] = useState(1), [result, setResult] = useState<Awaited<ReturnType<typeof searchStockProducts>> | null>(null), [newProduct, setNewProduct] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (open) void load(1); }, [open]);
  async function load(nextPage = page) { try { setError(""); const found = await searchStockProducts(query, nextPage); setResult(found); setPage(found.page); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível pesquisar produtos."); } }
  async function createQuick(form: FormData) { try { const product = await saveProduct(form); onChange({ ...product, balance: "0" }); setNewProduct(false); setOpen(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o produto."); } }
  return <div className="product-picker">
    <label className="field">{label}<div className="picker-value"><span>{value ? `${value.number} — ${value.name}` : "Nenhum produto selecionado"}</span><button className="btn secondary" type="button" onClick={() => setOpen(true)}>Pesquisar</button></div></label>
    {open && <div className="modal-backdrop" role="presentation"><section className="card picker-dialog" role="dialog" aria-modal="true" aria-label="Pesquisar produto">
      <div className="list-head"><h2>Selecionar produto</h2><button className="btn secondary" type="button" onClick={() => setOpen(false)}>Fechar</button></div>
      <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void load(1); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código ou nome" autoFocus /><button className="btn">Buscar</button>{allowCreate && <button className="btn secondary" type="button" onClick={() => setNewProduct(!newProduct)}>Cadastrar novo produto</button>}</form>
      {newProduct && <form action={createQuick} className="form-grid quick-product"><label className="field span-2">Nome<input name="name" required /></label><label className="field">Grupo<select name="groupId" required defaultValue=""><option value="">Selecione</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label><label className="field">Unidade<input name="unit" placeholder="UN" required /></label><label className="field">Estoque mínimo<input name="minimum" type="number" min="0" step="1" defaultValue="0" required /></label><label className="field">Valor atual<input name="currentUnitCost" type="number" min="0" step="0.0001" /></label><label className="field checkbox-field"><input name="requiresExpiry" type="checkbox" value="true" /> Controla vencimento</label><button className="btn">Cadastrar e selecionar</button></form>}
      {error && <p className="form-error">{error}</p>}
      {result && <><div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Unidade</th><th>Saldo</th><th></th></tr></thead><tbody>{result.products.map((product) => <tr key={product.id}><td>{product.number}</td><td>{product.name}</td><td>{product.unit}</td><td>{product.balance}</td><td><button type="button" className="btn" onClick={() => { onChange(product); setOpen(false); }}>Selecionar</button></td></tr>)}</tbody></table></div><nav className="pagination" aria-label="Paginação de produtos"><button type="button" className="btn secondary" disabled={result.page <= 1} onClick={() => void load(result.page - 1)}>Anterior</button><span>Página {result.page} de {result.totalPages}</span><button type="button" className="btn secondary" disabled={result.page >= result.totalPages} onClick={() => void load(result.page + 1)}>Próxima</button></nav></>}
    </section></div>}
  </div>;
}
