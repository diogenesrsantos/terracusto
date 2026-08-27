"use client";

import Link from "next/link";
import { useState } from "react";
import { saveWork } from "@/app/actions";
import { Empty } from "@/components/page";

export type WorkListItem = {
  id: string;
  code: number;
  name: string;
  client: string;
  description: string | null;
  startDate: string;
  startDateLabel: string;
  active: boolean;
};

export function WorksManager({ works, page, totalPages, totalWorks }: { works: WorkListItem[]; page: number; totalPages: number; totalWorks: number }) {
  const [selected, setSelected] = useState<WorkListItem | null>(null);

  async function submitWork(form: FormData) {
    await saveWork(form);
    setSelected(null);
  }

  return <>
    <section className="card"><h2>{selected ? "Alteração de obra" : "Nova obra"}</h2>
      <form key={selected?.id || "new"} action={submitWork} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field span-2">Nome da obra<input name="name" defaultValue={selected?.name || ""} required /></label>
        <label className="field">Início<input name="startDate" type="date" defaultValue={selected?.startDate || ""} /></label>
        <label className="field span-2">Cliente<input name="client" defaultValue={selected?.client || ""} required /></label>
        <label className="field">Descrição<input name="description" defaultValue={selected?.description || ""} /></label>
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar obra" : "Cadastrar obra"}</button>
        </div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Obras cadastradas</h2><span className="muted">{totalWorks} {totalWorks === 1 ? "obra" : "obras"}</span></div>
      {works.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Obra</th><th>Cliente</th><th>Início</th><th>Situação</th></tr></thead><tbody>
        {works.map((work) => <tr key={work.id} className={`selectable-row${selected?.id === work.id ? " selected" : ""}`} onClick={() => setSelected(work)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(work); } }} role="button" tabIndex={0} aria-selected={selected?.id === work.id}>
          <td><strong>{work.code}</strong></td><td><strong>{work.name}</strong></td><td>{work.client}</td><td>{work.startDateLabel}</td><td><span className={`badge${work.active ? "" : " warn"}`}>{work.active ? "Ativa" : "Encerrada"}</span></td>
        </tr>)}
      </tbody></table></div>}
      {totalPages > 1 && <nav className="pagination" aria-label="Paginação de obras">
        {page > 1 ? <Link className="btn secondary" href={`/obras?page=${page - 1}`}>Anterior</Link> : <button className="btn secondary" type="button" disabled>Anterior</button>}
        <span>Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn secondary" href={`/obras?page=${page + 1}`}>Próxima</Link> : <button className="btn secondary" type="button" disabled>Próxima</button>}
      </nav>}
    </section>
  </>;
}
