"use client";

import { useState } from "react";
import { deleteFuelTank, saveFuelTank } from "@/app/actions";
import { Empty } from "@/components/page";

type FuelTankItem = { id: string; name: string; kind: "FIXED" | "MOBILE"; capacity: string; fuelTypeId: string; fuelTypeName: string; notes: string | null; active: boolean; balance: number };
type FuelOption = { id: string; name: string; active: boolean };

export function FuelTankManager({ tanks, fuels }: { tanks: FuelTankItem[]; fuels: FuelOption[] }) {
  const [selected, setSelected] = useState<FuelTankItem | null>(null);
  async function submit(form: FormData) { await saveFuelTank(form); setSelected(null); }
  async function remove(form: FormData) {
    if (!window.confirm("Excluir este tanque? Se ele já tiver movimentações, será apenas desativado.")) return;
    await deleteFuelTank(form); setSelected(null);
  }
  return <section className="grid grid-2">
    <div className="card"><h2>{selected ? "Alterar tanque" : "Novo tanque"}</h2><form key={selected?.id || "new"} action={submit} className="form-grid">
      <input type="hidden" name="id" value={selected?.id || ""} />
      <label className="field span-2">Identificação<input name="name" defaultValue={selected?.name || ""} placeholder="Ex.: Tanque pátio 01" required /></label>
      <label className="field">Tipo<select name="kind" defaultValue={selected?.kind || "FIXED"}><option value="FIXED">Fixo</option><option value="MOBILE">Móvel</option></select></label>
      <label className="field">Capacidade (litros)<input name="capacity" type="number" min="0.001" step="0.001" defaultValue={selected?.capacity || ""} required /></label>
      <label className="field span-2">Combustível<select name="fuelTypeId" defaultValue={selected?.fuelTypeId || ""} required><option value="">Selecione</option>{fuels.map((fuel) => <option key={fuel.id} value={fuel.id} disabled={!fuel.active && fuel.id !== selected?.fuelTypeId}>{fuel.name}{fuel.active ? "" : " — inativo"}</option>)}</select></label>
      <label className="field span-2">Observações<input name="notes" defaultValue={selected?.notes || ""} /></label>
      {selected && <label className="field">Situação<select name="active" defaultValue={String(selected.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>}
      <div className="form-actions span-2">{selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button>}<button className="btn">{selected ? "Salvar alteração" : "Cadastrar tanque"}</button></div>
    </form></div>
    <div className="card"><h2>Tanques cadastrados</h2>{tanks.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Tanque</th><th>Tipo</th><th>Combustível</th><th>Capacidade</th><th>Saldo</th><th>Ação</th></tr></thead><tbody>{tanks.map((tank) => <tr key={tank.id} className={`selectable-row${selected?.id === tank.id ? " selected" : ""}`} onClick={() => setSelected(tank)} tabIndex={0} role="button"><td><strong>{tank.name}</strong><br /><small>{tank.active ? "Ativo" : "Inativo"}</small></td><td>{tank.kind === "FIXED" ? "Fixo" : "Móvel"}</td><td>{tank.fuelTypeName}</td><td>{Number(tank.capacity).toLocaleString("pt-BR")} L</td><td>{tank.balance.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L</td><td><form action={remove} onClick={(event) => event.stopPropagation()}><input type="hidden" name="id" value={tank.id} /><button className="btn danger">Excluir</button></form></td></tr>)}</tbody></table></div>}</div>
  </section>;
}
