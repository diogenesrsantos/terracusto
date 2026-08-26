import Link from "next/link";
import { getPermissions, requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";

const items = [
  ["dashboard.view", "/", "Visão geral"], ["people.manage", "/pessoas", "Pessoas"],
  ["users.manage", "/usuarios", "Usuários"], ["works.manage", "/obras", "Obras"],
  ["assets.manage", "/equipamentos", "Equipamentos"], ["accounting.manage", "/plano-contas", "Plano de contas"],
  ["accounting.manage", "/lancamentos", "Lançamentos"], ["closing.close", "/fechamentos", "Fechamentos"],
  ["fuel.manage", "/combustivel", "Combustível"], ["stock.manage", "/almoxarifado", "Almoxarifado"],
  ["maintenance.manage", "/manutencao", "Manutenção"],
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); const permissions = await getPermissions(user.userId);
  return <div className="app-shell"><aside className="sidebar">
    <Link href="/" className="logo"><span className="logo-mark">T</span><span>TerraCusto</span></Link>
    <nav className="nav">{items.filter(([permission]) => permissions.has(permission)).map(([, href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    <div className="sidebar-user"><div><strong>{user.name}</strong>{user.email}<br /><Link href="/perfil" className="link-button">Minha senha</Link></div><form action={logout}><button className="link-button">Sair</button></form></div>
  </aside><main className="main">{children}</main></div>;
}
