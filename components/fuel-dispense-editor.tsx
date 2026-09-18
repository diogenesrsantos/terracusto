"use client";

import { useEffect, useState } from "react";
import { deleteFuelDispense, updateFuelDispense } from "@/app/actions";

type EditorDispense = {
  id: string;
  operationId: string;
  date: string;
  liters: string;
  meter: string;
  source: "INTERNAL_TANK" | "DIRECT_SUPPLIER";
  document: string;
  unitPrice: string;
  paymentTerm: "CASH" | "CREDIT" | null;
  dueDate: string;
  personId: string;
  notes: string;
};

export function FuelDispenseEditor({ row, people }: { row: EditorDispense; people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [open, pending]);

  async function save(formData: FormData) {
    setPending(true); setError("");
    try {
      await updateFuelDispense(formData);
      setOpen(false);
    } catch {
      setError("Não foi possível salvar. Confira os campos e as regras da competência.");
    } finally { setPending(false); }
  }

  async function remove(formData: FormData) {
    if (!window.confirm("Excluir o abastecimento e todos os lançamentos vinculados?")) return;
    setPending(true); setError("");
    try {
      await deleteFuelDispense(formData);
      setOpen(false);
    } catch {
      setError("Não foi possível excluir. Verifique se a competência e a medição ainda permitem alterações.");
    } finally { setPending(false); }
  }

  return <>
    <button type="button" className="action-link button-link" onClick={() => setOpen(true)}>Alterar/excluir</button>
    {open && <div className="editor-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby={`edit-dispense-${row.id}`}>
        <header className="editor-dialog-head"><div><span>Operação {row.operationId.slice(0, 8)}</span><h2 id={`edit-dispense-${row.id}`}>Alterar abastecimento</h2></div><button type="button" className="editor-close" onClick={() => setOpen(false)} disabled={pending} aria-label="Fechar">×</button></header>
        <div className="editor-dialog-body">
          <form action={save} className="editor-form">
            <input type="hidden" name="id" value={row.id} />
            <label>Data<input type="date" name="date" defaultValue={row.date} required /></label>
            <label>Litros<input type="number" name="liters" min="0.001" step="0.001" defaultValue={row.liters} required /></label>
            <label>Horímetro/odômetro<input type="number" name="meter" min="0" step="0.01" defaultValue={row.meter} required /></label>
            {row.source === "DIRECT_SUPPLIER" && <><label>Documento/cupom<input name="document" defaultValue={row.document} required /></label><label>Preço por litro<input type="number" name="unitPrice" min="0.0001" step="0.0001" defaultValue={row.unitPrice} required /></label>{row.paymentTerm === "CREDIT" && <label>Vencimento<input type="date" name="dueDate" defaultValue={row.dueDate} required /></label>}</>}
            <label>Motorista/operador<select name="personId" defaultValue={row.personId}><option value="">Sem operador</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="editor-wide">Observação<input name="notes" defaultValue={row.notes} /></label>
            {error && <p className="error editor-wide" role="alert">{error}</p>}
            <div className="editor-actions editor-wide"><button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={pending}>Cancelar</button><button className="btn" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button></div>
          </form>
          <div className="editor-danger-zone"><div><strong>Excluir toda a operação</strong><p>Remove o abastecimento e os lançamentos contábeis e financeiros vinculados.</p></div><form action={remove}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="confirmDelete" value="true" /><button className="btn danger-btn" disabled={pending}>{pending ? "Aguarde..." : "Excluir operação"}</button></form></div>
        </div>
      </section>
    </div>}
  </>;
}
