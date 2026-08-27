"use client";

import Link from "next/link";
import { useState } from "react";
import { saveCompany } from "@/app/actions";
import { Empty } from "@/components/page";

export type CompanyListItem = {
  id: string;
  name: string;
  document: string | null;
  isFuelSupplier: boolean;
  active: boolean;
};

export function CompaniesManager({ companies, page, totalPages, totalCompanies }: {
  companies: CompanyListItem[];
  page: number;
  totalPages: number;
  totalCompanies: number;
}) {
  const [selected, setSelected] = useState<CompanyListItem | null>(null);

  async function submitCompany(form: FormData) {
    await saveCompany(form);
    setSelected(null);
  }

  return <>
    <section className="card"><h2>{selected ? "Alteração de empresa" : "Nova empresa"}</h2>
      <form key={selected?.id || "new"} action={submitCompany} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field span-2">Razão social/nome<input name="name" defaultValue={selected?.name || ""} required /></label>
        <label className="field">CNPJ/CPF<input name="document" defaultValue={selected?.document || ""} /></label>
        {selected && <label className="field">Situação<select name="active" defaultValue={String(selected.active)}><option value="true">Ativa</option><option value="false">Inativa</option></select></label>}
        <label className="field span-2"><span><input style={{ width: "auto", marginRight: 8 }} type="checkbox" name="isFuelSupplier" value="true" defaultChecked={selected?.isFuelSupplier || false} />Fornecedor de combustível</span></label>
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar empresa" : "Cadastrar empresa"}</button>
        </div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Empresas cadastradas</h2><span className="muted">{totalCompanies} {totalCompanies === 1 ? "empresa" : "empresas"}</span></div>
      {companies.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>CNPJ/CPF</th><th>Uso</th><th>Situação</th></tr></thead><tbody>
        {companies.map((company) => <tr key={company.id} className={`selectable-row${selected?.id === company.id ? " selected" : ""}`} onClick={() => setSelected(company)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(company); } }} role="button" tabIndex={0} aria-selected={selected?.id === company.id}>
          <td><strong>{company.name}</strong></td><td>{company.document || "—"}</td><td>{company.isFuelSupplier ? "Fornecedor de combustível" : "Empresa/cliente"}</td><td><span className={`badge${company.active ? "" : " warn"}`}>{company.active ? "Ativa" : "Inativa"}</span></td>
        </tr>)}
      </tbody></table></div>}
      {totalPages > 1 && <nav className="pagination" aria-label="Paginação de empresas">
        {page > 1 ? <Link className="btn secondary" href={`/empresas?page=${page - 1}`}>Anterior</Link> : <button className="btn secondary" type="button" disabled>Anterior</button>}
        <span>Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn secondary" href={`/empresas?page=${page + 1}`}>Próxima</Link> : <button className="btn secondary" type="button" disabled>Próxima</button>}
      </nav>}
    </section>
  </>;
}
