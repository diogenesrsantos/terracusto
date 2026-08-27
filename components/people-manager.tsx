"use client";

import Link from "next/link";
import { useState } from "react";
import { savePerson } from "@/app/actions";
import { Empty } from "@/components/page";

type PersonType = "EMPLOYEE" | "CONTRACTOR" | "OTHER";

export type PersonListItem = {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  type: PersonType;
  notes: string | null;
  active: boolean;
  jobFunctionId: string | null;
  jobFunctionName: string | null;
  activities: string[];
};

type JobFunctionOption = { id: string; name: string };

const typeLabel: Record<PersonType, string> = {
  EMPLOYEE: "Funcionário",
  CONTRACTOR: "Terceirizado",
  OTHER: "Outro",
};

export function PeopleManager({
  people,
  jobFunctions,
  page,
  totalPages,
  totalPeople,
}: {
  people: PersonListItem[];
  jobFunctions: JobFunctionOption[];
  page: number;
  totalPages: number;
  totalPeople: number;
}) {
  const [selected, setSelected] = useState<PersonListItem | null>(null);

  async function submitPerson(form: FormData) {
    await savePerson(form);
    setSelected(null);
  }

  return <>
    <section className="card"><h2>{selected ? "Alteração de cadastro" : "Novo cadastro"}</h2>
      <form key={selected?.id || "new"} action={submitPerson} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field span-2">Nome completo<input name="name" defaultValue={selected?.name || ""} required /></label>
        <label className="field">CPF<input name="cpf" inputMode="numeric" defaultValue={selected?.cpf || ""} /></label>
        <label className="field">Tipo<select name="type" defaultValue={selected?.type || "EMPLOYEE"}><option value="EMPLOYEE">Funcionário</option><option value="CONTRACTOR">Terceirizado</option><option value="OTHER">Outro</option></select></label>
        <label className="field">Função<select name="jobFunctionId" defaultValue={selected?.jobFunctionId || ""}><option value="">Sem função</option>{jobFunctions.map((jobFunction) => <option key={jobFunction.id} value={jobFunction.id}>{jobFunction.name}</option>)}</select></label>
        <label className="field">Telefone<input name="phone" defaultValue={selected?.phone || ""} /></label><label className="field span-2">E-mail<input name="email" type="email" defaultValue={selected?.email || ""} /></label>
        <label className="field span-3">Observações<input name="notes" defaultValue={selected?.notes || ""} /></label>
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar cadastro" : "Cadastrar pessoa"}</button>
        </div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Cadastros</h2><span className="muted">{totalPeople} {totalPeople === 1 ? "pessoa" : "pessoas"}</span></div>
      {people.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Função e atividades</th><th>CPF</th><th>Contato</th><th>Situação</th></tr></thead><tbody>
        {people.map((person) => <tr
          key={person.id}
          className={`selectable-row${selected?.id === person.id ? " selected" : ""}`}
          onClick={() => setSelected(person)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(person); } }}
          role="button"
          tabIndex={0}
          aria-selected={selected?.id === person.id}
        ><td><strong>{person.name}</strong><br /><small className="muted">{typeLabel[person.type]}</small></td><td>{person.jobFunctionName || "—"}<br /><small>{person.activities.join(", ")}</small></td><td>{person.cpf || "—"}</td><td>{person.phone || person.email || "—"}</td><td><span className="badge">{person.active ? "Ativo" : "Inativo"}</span></td></tr>)}
      </tbody></table></div>}
      {totalPages > 1 && <nav className="pagination" aria-label="Paginação de pessoas">
        {page > 1 ? <Link className="btn secondary" href={`/pessoas?page=${page - 1}`}>Anterior</Link> : <span />}
        <span>Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn secondary" href={`/pessoas?page=${page + 1}`}>Próxima</Link> : <span />}
      </nav>}
    </section>
  </>;
}
