"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteProduct, deleteProductGroup, saveProduct, saveProductGroup } from "@/app/actions";
import { Empty } from "@/components/page";

type Group = { id: string; name: string; active: boolean };
type Product = { id: string; number: number; name: string; unit: string; minimum: string; currentUnitCost: string; requiresExpiry: boolean; active: boolean; groupId: string; groupName: string };

export function ProductsManager({ products, groups, page, totalPages, total }: { products: Product[]; groups: Group[]; page: number; totalPages: number; total: number }) {
  const [selected, setSelected] = useState<Product | null>(null);
  async function save(form: FormData) { await saveProduct(form); setSelected(null); }
  async function saveGroup(form: FormData) { await saveProductGroup(form); }
  return <>
    <section className="card"><h2>Grupos de produtos</h2><form action={saveGroup} className="inline-form"><input name="name" placeholder="Ex.: Peças de motor" required /><button className="btn">Adicionar grupo</button></form><div className="chips mt">{groups.map((group) => <details className="chip" key={group.id}><summary>{group.name}{!group.active && " — inativo"}</summary><form action={saveGroup} className="inline-form"><input type="hidden" name="id" value={group.id} /><input name="name" defaultValue={group.name} required /><label><input type="checkbox" name="active" value="true" defaultChecked={group.active} /> Ativo</label><button className="btn secondary">Salvar</button></form><form action={deleteProductGroup}><input type="hidden" name="id" value={group.id} /><button className="link-button">Excluir/inativar</button></form></details>)}</div></section>
    <section className="card mt"><h2>{selected ? `Alterar produto ${selected.number}` : "Novo produto"}</h2><form key={selected?.id || "new"} action={save} className="form-grid"><input name="id" type="hidden" value={selected?.id || ""} />
      <label className="field">Código<input value={selected?.number || "Gerado automaticamente"} readOnly /></label><label className="field span-2">Nome<input name="name" defaultValue={selected?.name || ""} required /></label>
      <label className="field">Grupo<select name="groupId" defaultValue={selected?.groupId || ""} required><option value="">Selecione</option>{groups.map((group) => <option value={group.id} key={group.id} disabled={!group.active && group.id !== selected?.groupId}>{group.name}</option>)}</select></label><label className="field">Unidade<input name="unit" defaultValue={selected?.unit || "UN"} required /></label><label className="field">Estoque mínimo<input name="minimum" type="number" min="0" step="1" defaultValue={selected?.minimum || "0"} required /></label><label className="field">Valor unitário atual<input name="currentUnitCost" type="number" min="0" step="0.0001" defaultValue={selected?.currentUnitCost || ""} /></label>
      <label className="field checkbox-field"><input name="requiresExpiry" type="checkbox" value="true" defaultChecked={selected?.requiresExpiry} /> Controla data de vencimento</label>{selected && <label className="field checkbox-field"><input name="active" type="checkbox" value="true" defaultChecked={selected.active} /> Produto ativo</label>}
      <div className="form-actions">{selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button>}<button className="btn">{selected ? "Salvar produto" : "Cadastrar produto"}</button></div>
    </form></section>
    <section className="card mt"><div className="list-head"><h2>Produtos cadastrados</h2><span className="muted">{total} produtos</span></div>{products.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Produto</th><th>Grupo</th><th>Unidade</th><th>Mínimo</th><th>Valor atual</th><th>Situação</th><th></th></tr></thead><tbody>{products.map((product) => <tr className={`selectable-row${selected?.id === product.id ? " selected" : ""}`} key={product.id} onDoubleClick={() => setSelected(product)}><td>{product.number}</td><td>{product.name}{product.requiresExpiry && <small> — controla vencimento</small>}</td><td>{product.groupName}</td><td>{product.unit}</td><td>{product.minimum}</td><td>{product.currentUnitCost || "—"}</td><td>{product.active ? "Ativo" : "Inativo"}</td><td><button className="btn secondary" type="button" onClick={() => setSelected(product)}>Editar</button> <form className="inline-action" action={deleteProduct}><input type="hidden" name="id" value={product.id} /><button className="link-button" title="Excluir ou inativar">Excluir</button></form></td></tr>)}</tbody></table></div>}
      {totalPages > 1 && <nav className="pagination"><Link className="btn secondary" href={`/almoxarifado/produtos?page=${page - 1}`} aria-disabled={page <= 1}>Anterior</Link><span>Página {page} de {totalPages}</span><Link className="btn secondary" href={`/almoxarifado/produtos?page=${page + 1}`} aria-disabled={page >= totalPages}>Próxima</Link></nav>}
    </section>
  </>;
}
