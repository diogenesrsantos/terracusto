"use client";
import { useState, useTransition } from "react";
export function MaintenanceForm({ action, children, confirmMessage }: { action: (form: FormData) => Promise<void | { error: string }>; children: React.ReactNode; confirmMessage?: string }) {
  const [error, setError] = useState(""); const [pending, start] = useTransition();
  return <form className="form-grid" action={form => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setError(""); start(async () => { try { const result = await action(form); if (result?.error) setError(result.error); } catch (e) {
      if (e && typeof e === "object" && "digest" in e && String(e.digest).startsWith("NEXT_REDIRECT")) throw e;
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } });
  }}><fieldset disabled={pending} style={{ display: "contents" }}>{children}</fieldset>{pending && <p role="status" className="span-4">Salvando…</p>}{error && <p role="alert" className="span-4">{error}</p>}</form>;
}
export function MaintenancePartFields({ products, today }: { products: { id: string; number: number; name: string; cost: string }[]; today: string }) {
  const [source, setSource] = useState("STOCK"), [cost, setCost] = useState("");
  return <>
    <label className="field">Origem<select name="source" value={source} onChange={e => { setSource(e.target.value); setCost(""); }}><option value="STOCK">Almoxarifado</option><option value="SUPPLIER">Direto do fornecedor</option></select></label>
    <label className="field">Data da adição<input name="date" type="date" defaultValue={today} max={today} required /></label>
    {source === "STOCK" ? <label className="field span-2">Peça do almoxarifado<select name="productId" required onChange={e => setCost(products.find(p => p.id === e.target.value)?.cost || "")}><option value="">Selecione</option>{products.map(p => <option key={p.id} value={p.id}>{p.number} — {p.name}</option>)}</select></label> : <><label className="field">Descrição da peça<input name="description" required /></label><label className="field">Número da nota fiscal<input name="invoice" required /></label></>}
    <label className="field">Quantidade<input name="quantity" type="number" min="1" step="1" required /></label>
    <label className="field">Preço unitário (editável)<input name="unitCost" type="number" min="0" step="0.0001" required value={cost} onChange={e => setCost(e.target.value)} /></label><button className="btn">Adicionar peça</button>
  </>;
}
