"use client";

import Link from "next/link";
import { useState } from "react";
import { saveUser } from "@/app/actions";
import { Empty } from "@/components/page";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  personId: string | null;
  roleId: string;
  roleNames: string[];
};

type RoleOption = { id: string; name: string };
type PersonOption = { id: string; name: string; active: boolean; userId: string | null };

export function UsersManager({ users, roles, people, page, totalPages, totalUsers }: {
  users: UserListItem[];
  roles: RoleOption[];
  people: PersonOption[];
  page: number;
  totalPages: number;
  totalUsers: number;
}) {
  const [selected, setSelected] = useState<UserListItem | null>(null);

  async function submitUser(form: FormData) {
    await saveUser(form);
    setSelected(null);
  }

  return <>
    <section className="card"><h2>{selected ? "Alteração de usuário" : "Novo usuário"}</h2>
      <form key={selected?.id || "new"} action={submitUser} className="form-grid">
        <input type="hidden" name="id" value={selected?.id || ""} />
        <label className="field">Nome<input name="name" defaultValue={selected?.name || ""} required /></label>
        <label className="field">E-mail<input name="email" type="email" defaultValue={selected?.email || ""} required /></label>
        <label className="field">{selected ? "Nova senha (opcional)" : "Senha inicial"}<input name="password" type="password" minLength={8} required={!selected} /></label>
        <label className="field">Perfil<select name="roleId" defaultValue={selected?.roleId || roles[0]?.id || ""} required><option value="">Selecione</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <label className="field span-3">Vincular a pessoa<select name="personId" defaultValue={selected?.personId || ""}><option value="">Sem vínculo</option>{people.map((person) => {
          const unavailable = person.id !== selected?.personId && (!person.active || Boolean(person.userId && person.userId !== selected?.id));
          return <option key={person.id} value={person.id} disabled={unavailable}>{person.name}{!person.active ? " — inativa" : person.userId && person.userId !== selected?.id ? " — já vinculada" : ""}</option>;
        })}</select></label>
        <div className="form-actions">
          {selected && <button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancelar alteração</button>}
          <button className="btn" type="submit">{selected ? "Salvar usuário" : "Criar usuário"}</button>
        </div>
      </form>
    </section>

    <section className="card mt"><div className="list-head"><h2>Usuários</h2><span className="muted">{totalUsers} {totalUsers === 1 ? "usuário" : "usuários"}</span></div>
      {users.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id} className={`selectable-row${selected?.id === user.id ? " selected" : ""}`} onClick={() => setSelected(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(user); } }} role="button" tabIndex={0} aria-selected={selected?.id === user.id}>
          <td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.roleNames.join(", ") || "—"}</td><td><span className={`badge${user.active ? "" : " warn"}`}>{user.active ? "Ativo" : "Inativo"}</span></td>
        </tr>)}
      </tbody></table></div>}
      {totalPages > 1 && <nav className="pagination" aria-label="Paginação de usuários">
        {page > 1 ? <Link className="btn secondary" href={`/usuarios?page=${page - 1}`}>Anterior</Link> : <button className="btn secondary" type="button" disabled>Anterior</button>}
        <span>Página {page} de {totalPages}</span>
        {page < totalPages ? <Link className="btn secondary" href={`/usuarios?page=${page + 1}`}>Próxima</Link> : <button className="btn secondary" type="button" disabled>Próxima</button>}
      </nav>}
    </section>
  </>;
}
