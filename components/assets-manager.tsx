"use client";

import Link from "next/link";
import { useState } from "react";
import { saveAsset } from "@/app/actions";
import { Empty } from "@/components/page";

export type AssetListItem = {
  id: string;
  equipmentTypeId: string;
  equipmentTypeName: string;
  identifier: string;
  description: string;
  brand: string | null;
  model: string | null;
  fuelTypeId: string | null;
  fuelTypeName: string | null;
  expectedUsage: string;
  active: boolean;
};

type Option = { id: string; name: string; active: boolean };

export function AssetsManager({ assets, fuels, equipmentTypes, page, totalPages, totalAssets }: {
  assets: AssetListItem[];
  fuels: Option[];
  equipmentTypes: Option[];
  page: number;
  totalPages: number;
  totalAssets: number;
}) {
  const [selected, setSelected] = useState<AssetListItem | null>(null);

  async function submitAsset(form: FormData) {
    await saveAsset(form);
    setSelected(null);
  }

  return <>
    <section className="card mt"><h2>{selected ? "Alteração de equipamento" : "Novo equipamento"}</h2>
      <form key={selected?.id || "new"} action={submitAsset} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field">Tipo<select name="equipmentTypeId" defaultValue={selected?.equipmentTypeId || ""} required><option value="">Selecione</option>{equipmentTypes.map((type) => <option key={type.id} value={type.id} disabled={!type.active && type.id !== selected?.equipmentTypeId}>{type.name}{type.active ? "" : " — inativo"}</option>)}</select></label>
        <label className="field">Identificador/placa<input name="identifier" defaultValue={selected?.identifier || ""} required /></label>
        <label className="field span-2">Descrição<input name="description" defaultValue={selected?.description || ""} required /></label>
        <label className="field">Marca<input name="brand" defaultValue={selected?.brand || ""} /></label>
        <label className="field">Modelo<input name="model" defaultValue={selected?.model || ""} /></label>
        <label className="field">Combustível<select name="fuelTypeId" defaultValue={selected?.fuelTypeId || ""}><option value="">Não se aplica</option>{fuels.map((fuel) => <option key={fuel.id} value={fuel.id} disabled={!fuel.active && fuel.id !== selected?.fuelTypeId}>{fuel.name}{fuel.active ? "" : " — inativo"}</option>)}</select></label>
        <label className="field">Consumo esperado<input name="expectedUsage" type="number" step="0.001" defaultValue={selected?.expectedUsage || ""} /></label>
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar equipamento" : "Cadastrar equipamento"}</button>
        </div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Frota e ativos</h2><span className="muted">{totalAssets} {totalAssets === 1 ? "equipamento" : "equipamentos"}</span></div>
      {assets.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Identificador</th><th>Tipo</th><th>Descrição</th><th>Marca/modelo</th><th>Combustível</th><th>Situação</th></tr></thead><tbody>
        {assets.map((asset) => <tr key={asset.id} className={`selectable-row${selected?.id === asset.id ? " selected" : ""}`} onClick={() => setSelected(asset)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(asset); } }} role="button" tabIndex={0} aria-selected={selected?.id === asset.id}>
          <td><strong>{asset.identifier}</strong></td><td>{asset.equipmentTypeName}</td><td>{asset.description}</td><td>{[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}</td><td>{asset.fuelTypeName || "—"}</td><td><span className={`badge${asset.active ? "" : " warn"}`}>{asset.active ? "Ativo" : "Inativo"}</span></td>
        </tr>)}
      </tbody></table></div>}
      {totalPages > 1 && <nav className="pagination" aria-label="Paginação de equipamentos">
        {page > 1 ? <Link className="btn secondary" href={`/equipamentos?page=${page - 1}`}>Anterior</Link> : <button className="btn secondary" type="button" disabled>Anterior</button>}
        <span>Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn secondary" href={`/equipamentos?page=${page + 1}`}>Próxima</Link> : <button className="btn secondary" type="button" disabled>Próxima</button>}
      </nav>}
    </section>
  </>;
}
