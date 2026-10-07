"use client";

import { useState } from "react";
import { createStockEntry } from "@/app/actions";
import { PickedProduct, ProductPicker } from "@/components/product-picker";

type Group = { id: string; name: string };
export function StockEntryForm({ groups, today }: { groups: Group[]; today: string }) {
  const [product, setProduct] = useState<PickedProduct | null>(null), [date, setDate] = useState(today), [document, setDocument] = useState(""), [quantity, setQuantity] = useState(""), [unitCost, setUnitCost] = useState(""), [expirationDate, setExpirationDate] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!product) return setError("Selecione um produto."); try { setError(""); const form = new FormData(); form.set("productId", product.id); form.set("date", date); form.set("document", document); form.set("quantity", quantity); form.set("unitCost", unitCost); form.set("expirationDate", expirationDate); await createStockEntry(form); setQuantity(""); setUnitCost(""); setExpirationDate(""); setProduct(null); setMessage("Entrada registrada. A nota fiscal e a data foram mantidas para a próxima entrada."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a entrada."); } }
  const lowerPrice = product && product.currentUnitCost && unitCost && Number(unitCost) < Number(product.currentUnitCost);
  return <section className="card"><h2>Adicionar ao estoque</h2><form className="form-grid" onSubmit={submit}><ProductPicker value={product} onChange={(selected) => { setProduct(selected); setUnitCost(selected.currentUnitCost); setExpirationDate(""); }} groups={groups} allowCreate label="Produto" />
    {product && <div className="field"><span>Saldo atual</span><strong>{product.balance} {product.unit}</strong></div>}
    <label className="field">Número da nota fiscal<input value={document} onChange={(event) => setDocument(event.target.value)} required /></label><label className="field">Data da adição<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
    <label className="field">Quantidade<input type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label className="field">Valor unitário<input type="number" min="0" step="0.0001" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} required /></label>
    {product?.requiresExpiry && <label className="field">Data de vencimento<input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} required /></label>}
    {lowerPrice && <p className="form-warning span-2">Atenção: o valor informado é menor que o valor atual ({product?.currentUnitCost}). O novo valor passará a ser o valor atual do produto.</p>}
    {error && <p className="form-error span-2">{error}</p>}{message && <p className="form-success span-2">{message}</p>}<button className="btn">Registrar entrada</button>
  </form></section>;
}
