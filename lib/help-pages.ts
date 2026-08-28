export const HELP_PAGES = [
  { key: "/", label: "Visão geral" },
  { key: "/pessoas", label: "Pessoas" },
  { key: "/usuarios", label: "Usuários e acessos" },
  { key: "/empresas", label: "Empresas" },
  { key: "/obras", label: "Obras" },
  { key: "/equipamentos", label: "Equipamentos" },
  { key: "/configuracoes", label: "Configurações da empresa" },
  { key: "/plano-contas", label: "Plano de contas" },
  { key: "/tipos-lancamento", label: "Tipos de lançamento" },
  { key: "/lancamentos", label: "Centro de custos" },
  { key: "/relatorios/centro-custos", label: "Relatório de centro de custo" },
  { key: "/fechamentos", label: "Fechamentos" },
  { key: "/combustivel", label: "Combustível" },
  { key: "/almoxarifado", label: "Almoxarifado" },
  { key: "/manutencao", label: "Manutenção" },
] as const;

export const isHelpPage = (value: string) => HELP_PAGES.some((page) => page.key === value);
