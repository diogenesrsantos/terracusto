"use client";

import { useState } from "react";
import { deleteFuelType, saveFuelType } from "@/app/actions";
import { Empty } from "@/components/page";

export type FuelTypeItem = {
  id: string;
  name: string;
  referencePrice: string | null;
  active: boolean;
};

export function FuelTypeManager({ fuelTypes }: { fuelTypes: FuelTypeItem[] }) {
  const [selected, setSelected] = useState<FuelTypeItem | null>(null);

  async function submitFuelType(form: FormData) {
    await saveFuelType(form);
    setSelected(null);
  }

  async function removeFuelType(form: FormData) {
    if (!window.confirm("Deseja excluir este combustível? Se ele já estiver em uso, será apenas desativado para preservar o histórico.")) return;
    await deleteFuelType(form);
    setSelected(null);
  }

  return <section className="grid grid-2">
    <div className="card"><h2>{selected ? "Alteração de combustível" : "Novo combustível"}</h2>
      <form key={selected?.id || "new"} action={submitFuelType} className="grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field">Nome<input name="name" defaultValue={selected?.name || ""} placeholder="Ex.: Diesel marítimo" required /></label>
        <label className="field">Preço de referência por litro<input name="referencePrice" type="number" min="0" step="0.0001" defaultValue={selected?.referencePrice || ""} /></label>
        {selected && <label className="field">Situação<select name="active" defaultValue={String(selected.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>}
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar combustível" : "Cadastrar combustível"}</button>
        </div>
      </form>
    </div>
    <div className="card"><h2>Combustíveis cadastrados</h2>
      {fuelTypes.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Preço ref.</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
        {fuelTypes.map((fuelType) => <tr
          key={fuelType.id}
          className={`selectable-row${selected?.id === fuelType.id ? " selected" : ""}`}
          onClick={() => setSelected(fuelType)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(fuelType); } }}
          role="button"
          tabIndex={0}
          aria-selected={selected?.id === fuelType.id}
        ><td><strong>{fuelType.name}</strong></td><td>{fuelType.referencePrice ? Number(fuelType.referencePrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 }) : "—"}</td><td><span className={`badge ${fuelType.active ? "" : "warn"}`}>{fuelType.active ? "Ativo" : "Inativo"}</span></td><td><form action={removeFuelType} onClick={(event) => event.stopPropagation()}><input type="hidden" name="id" value={fuelType.id} /><button className="btn danger" type="submit">Excluir</button></form></td></tr>)}
      </tbody></table></div>}
    </div>
  </section>;
}
