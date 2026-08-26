import { createRole, createUser } from "@/app/actions";
import { Empty, PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export default async function UsersPage() {
  await requirePermission("users.manage");
  const [users, roles, people, permissions] = await Promise.all([
    db.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { name: "asc" } }),
    db.role.findMany({ orderBy: { name: "asc" } }), db.person.findMany({ where: { user: null, active: true }, orderBy: { name: "asc" } }),
    db.permission.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Usuários e acessos" subtitle="Somente administradores e pessoal autorizado do escritório." />
    <section className="card"><h2>Novo usuário</h2><form action={createUser} className="form-grid">
      <label className="field">Nome<input name="name" required /></label><label className="field">E-mail<input name="email" type="email" required /></label>
      <label className="field">Senha inicial<input name="password" type="password" minLength={8} required /></label>
      <label className="field">Perfil<select name="roleId" required>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label className="field span-3">Vincular a pessoa<select name="personId"><option value="">Sem vínculo</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button className="btn">Criar usuário</button>
    </form></section>
    <section className="card mt"><h2>Novo perfil de acesso</h2><form action={createRole} className="form-grid"><label className="field">Código<input name="code" required /></label><label className="field span-3">Nome do perfil<input name="name" required /></label><div className="span-4 grid grid-3">{permissions.map((p) => <label key={p.id}><input style={{width:"auto", marginRight:8}} type="checkbox" name="permissionId" value={p.id} />{p.name}</label>)}</div><button className="btn span-4">Criar perfil</button></form></section>
    <section className="card mt"><h2>Usuários</h2>{users.length === 0 ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th></tr></thead><tbody>
      {users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.roles.map((r) => r.role.name).join(", ")}</td><td><span className="badge">{u.active ? "Ativo" : "Inativo"}</span></td></tr>)}
    </tbody></table></div>}</section>
  </>;
}
