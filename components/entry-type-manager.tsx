"use client";

import { useState } from "react";
import { deleteEntryType, saveEntryType } from "@/app/actions";
import { Empty } from "@/components/page";

type AccountOption = { id: string; label: string };
export type EntryTypeItem = {
  id: string;
  name: string;
  active: boolean;
  defaultDebitAccountId: string;
  defaultCreditAccountId: string;
  defaultDebitAccountLabel: string;
  defaultCreditAccountLabel: string;
};

export function EntryTypeManager({ entryTypes, accounts }: { entryTypes: EntryTypeItem[]; accounts: AccountOption[] }) {
  const [selected, setSelected] = useState<EntryTypeItem | null>(null);

  async function submitEntryType(form: FormData) {
    await saveEntryType(form);
    setSelected(null);
  }

  async function removeEntryType(form: FormData) {
    if (!window.confirm("Deseja excluir este tipo de lançamento? Se ele já estiver em uso, será apenas desativado para preservar o histórico.")) return;
    await deleteEntryType(form);
    setSelected(null);
  }

  return <section className="grid grid-2">
    <div className="card"><h2>{selected ? "Alteração do tipo" : "Novo tipo de lançamento"}</h2><form key={selected?.id || "new"} action={submitEntryType} className="grid">
      <input type="hidden" name="id" value={selected?.id || ""} />
      <label className="field">Nome<input name="name" defaultValue={selected?.name || ""} placeholder="Ex.: Serviço de transporte" required /></label>
      <label className="field">Conta devedora padrão<select name="defaultDebitAccountId" defaultValue={selected?.defaultDebitAccountId || ""} required><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
      <label className="field">Conta credora padrão<select name="defaultCreditAccountId" defaultValue={selected?.defaultCreditAccountId || ""} required><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></label>
      {selected && <label className="field">Situação<select name="active" defaultValue={String(selected.active)}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>}
      <div className="form-actions">{selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}<button className="btn">{selected ? "Salvar tipo" : "Cadastrar tipo"}</button></div>
    </form></div>
    <div className="card"><h2>Tipos cadastrados</h2>{entryTypes.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Contas padrão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{entryTypes.map((entryType) => <tr key={entryType.id} className={`selectable-row${selected?.id === entryType.id ? " selected" : ""}`} onClick={() => setSelected(entryType)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(entryType); } }} role="button" tabIndex={0} aria-selected={selected?.id === entryType.id}>
      <td><strong>{entryType.name}</strong></td><td><small>D · {entryType.defaultDebitAccountLabel}</small><br /><small>C · {entryType.defaultCreditAccountLabel}</small></td><td><span className={`badge ${entryType.active ? "" : "warn"}`}>{entryType.active ? "Ativo" : "Inativo"}</span></td><td><form action={removeEntryType} onClick={(event) => event.stopPropagation()}><input type="hidden" name="id" value={entryType.id} /><button className="btn danger">Excluir</button></form></td>
    </tr>)}</tbody></table></div>}</div>
  </section>;
}
