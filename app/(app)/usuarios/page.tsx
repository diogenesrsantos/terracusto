import { createRole } from "@/app/actions";
import { UsersManager } from "@/components/users-manager";
import { PageHead } from "@/components/page";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

const PAGE_SIZE = 20;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("users.manage");
  const requestedPage = Number.parseInt((await searchParams).page || "1", 10);
  const totalUsers = await db.user.count();
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const page = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const [users, roles, people, permissions] = await Promise.all([
    db.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.role.findMany({ orderBy: { name: "asc" } }),
    db.person.findMany({ select: { id: true, name: true, active: true, user: { select: { id: true } } }, orderBy: { name: "asc" } }),
    db.permission.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <><PageHead title="Usuários e acessos" subtitle="Somente administradores e pessoal autorizado do escritório." />
    <UsersManager key={page} users={users.map((user) => ({
      id: user.id, name: user.name, email: user.email, active: user.active, personId: user.personId,
      roleId: user.roles[0]?.roleId || "", roleNames: user.roles.map(({ role }) => role.name),
    }))} roles={roles.map(({ id, name }) => ({ id, name }))} people={people.map((person) => ({
      id: person.id, name: person.name, active: person.active, userId: person.user?.id || null,
    }))} page={page} totalPages={totalPages} totalUsers={totalUsers} />
    <section className="card mt"><h2>Novo perfil de acesso</h2><form action={createRole} className="form-grid"><label className="field">Código<input name="code" required /></label><label className="field span-3">Nome do perfil<input name="name" required /></label><div className="span-4 grid grid-3">{permissions.map((permission) => <label key={permission.id}><input style={{ width: "auto", marginRight: 8 }} type="checkbox" name="permissionId" value={permission.id} />{permission.name}</label>)}</div><button className="btn span-4">Criar perfil</button></form></section>
  </>;
}
