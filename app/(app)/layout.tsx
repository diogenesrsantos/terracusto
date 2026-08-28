import Link from "next/link";
import { getPermissions, requireUser } from "@/lib/auth";
import { logout } from "@/app/actions";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeSelector } from "@/components/theme-selector";
import { isThemeName } from "@/lib/themes";
import { db } from "@/lib/db";
import { ContextualHelp } from "@/components/contextual-help";

const directItems = [["dashboard.view", "/", "Visão geral"]] as const;
const groups = [
  { label: "Cadastros", items: [
    ["people.manage", "/pessoas", "Pessoas"], ["users.manage", "/usuarios", "Usuários e acessos"],
    ["companies.manage", "/empresas", "Empresas"], ["works.manage", "/obras", "Obras"],
    ["assets.manage", "/equipamentos", "Equipamentos"],
    ["settings.manage", "/configuracoes", "Configurações da empresa"],
    ["help.manage", "/ajuda", "Manuais de ajuda"],
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
  const user = await requireUser(); const [permissions, preferences, helpGuides] = await Promise.all([
    getPermissions(user.userId), db.user.findUnique({ where: { id: user.userId }, select: { theme: true } }),
    db.helpGuide.findMany({ where: { active: true }, select: { pageKey: true, title: true, steps: { orderBy: { position: "asc" }, select: { id: true, title: true, content: true, images: { orderBy: { position: "asc" }, select: { id: true } } } } } }),
  ]);
  const theme = preferences && isThemeName(preferences.theme) ? preferences.theme : "forest";
  const visibleGroups = groups.map((group) => ({ label: group.label, items: group.items
    .filter(([permission]) => permissions.has(permission))
    .map(([, href, label]) => ({ href, label })) })).filter((group) => group.items.length > 0);
  return <div className="app-shell" data-theme={theme}><aside className="sidebar">
    <Link href="/" className="logo"><span className="logo-mark">T</span><span>TerraCusto</span></Link>
    <SidebarNav directItems={directItems.filter(([permission]) => permissions.has(permission)).map(([, href, label]) => ({ href, label }))} groups={visibleGroups} />
    <ThemeSelector initialTheme={theme} />
    <div className="sidebar-user"><div><strong>{user.name}</strong>{user.email}<br /><Link href="/perfil" className="link-button">Minha senha</Link></div><form action={logout}><button className="link-button">Sair</button></form></div>
  </aside><main className="main"><ContextualHelp guides={helpGuides} />{children}</main></div>;
}
