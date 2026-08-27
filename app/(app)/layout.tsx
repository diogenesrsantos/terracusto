import Link from "next/link";
import { getPermissions, requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { SidebarNav } from "@/components/sidebar-nav";

const directItems = [["dashboard.view", "/", "Visão geral"]] as const;
const groups = [
  { label: "Cadastros", items: [
    ["people.manage", "/pessoas", "Pessoas"], ["users.manage", "/usuarios", "Usuários e acessos"],
    ["companies.manage", "/empresas", "Empresas"], ["works.manage", "/obras", "Obras"],
    ["assets.manage", "/equipamentos", "Equipamentos"],
    ["settings.manage", "/configuracoes", "Configurações da empresa"],
  ] },
  { label: "Contabilidade", items: [
    ["accounting.manage", "/plano-contas", "Plano de contas"], ["accounting.manage", "/tipos-lancamento", "Tipos de lançamento"],
    ["accounting.manage", "/lancamentos", "Centro de custos"],
    ["accounting.manage", "/relatorios/centro-custos", "Relatório de centro de custo"],
    ["closing.close", "/fechamentos", "Fechamentos"],
  ] },
  { label: "Operacional", items: [
    ["fuel.manage", "/combustivel", "Combustível"], ["stock.manage", "/almoxarifado", "Almoxarifado"],
    ["maintenance.manage", "/manutencao", "Manutenção"],
  ] },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); const permissions = await getPermissions(user.userId);
  const visibleGroups = groups.map((group) => ({ label: group.label, items: group.items
    .filter(([permission]) => permissions.has(permission))
    .map(([, href, label]) => ({ href, label })) })).filter((group) => group.items.length > 0);
  return <div className="app-shell"><aside className="sidebar">
    <Link href="/" className="logo"><span className="logo-mark">T</span><span>TerraCusto</span></Link>
    <SidebarNav directItems={directItems.filter(([permission]) => permissions.has(permission)).map(([, href, label]) => ({ href, label }))} groups={visibleGroups} />
    <div className="sidebar-user"><div><strong>{user.name}</strong>{user.email}<br /><Link href="/perfil" className="link-button">Minha senha</Link></div><form action={logout}><button className="link-button">Sair</button></form></div>
  </aside><main className="main">{children}</main></div>;
}
