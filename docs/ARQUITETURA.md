# Arquitetura técnica

## Visão geral

O TerraCusto é uma aplicação monolítica Next.js com App Router. As páginas são
renderizadas no servidor, formulários chamam Server Actions e toda persistência
passa pelo Prisma para um PostgreSQL único.

```text
Navegador/PWA
    │ HTTPS
    ▼
Nginx :443
    │ proxy HTTP local
    ▼
Next.js :3120 ── Prisma Client ── PostgreSQL
    │
    ├── Server Components: consultas e telas
    ├── Server Actions: validação, escrita e auditoria
    └── /api/health: teste de aplicação e banco
```

## Estrutura do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `app/(app)` | Área autenticada e módulos funcionais |
| `app/actions.ts` | Escritas, regras de negócio e revalidação de páginas |
| `app/api/health` | Health check com `SELECT 1` |
| `components` | Componentes visuais compartilhados |
| `lib/auth.ts` | Sessão JWT e autorização por permissão |
| `lib/audit.ts` | Persistência do histórico de ações |
| `lib/db.ts` | Instância compartilhada do Prisma Client |
| `lib/format.ts` | Datas, números, moeda e competência |
| `lib/rate-limit.ts` | Limite de tentativas de login por IP |
| `prisma/schema.prisma` | Modelo de dados canônico |
| `prisma/migrations` | Histórico aplicável em produção |
| `prisma/seed.ts` | Perfis, permissões e cadastros iniciais |
| `public/sw.js` | Cache dos recursos estáticos da PWA |
| `deployment` | Nginx, systemd, backup e manual operacional |
| `scripts/smoke.mjs` | Teste ponta a ponta mínimo |

`components/account-tree-view.tsx` monta no cliente a árvore do plano de contas
a partir de `parentId`. Os grupos sintéticos começam contraídos, mantêm o estado
de abertura localmente e expõem semântica ARIA de `tree`, `treeitem` e `group`.
Os ícones são SVGs locais, sem biblioteca ou recurso externo.

`components/sidebar-nav.tsx` recebe do layout somente os itens autorizados pelo
servidor. No cliente, usa a rota atual para destacar o item e abrir seu grupo e
mantém o estado dos demais submenus localmente. Os gatilhos publicam
`aria-expanded`/`aria-controls`; a autorização real continua nas páginas e nas
Server Actions, não no componente visual.

A edição de `Account` aceita somente `name` e `parentId`; código, natureza e
classificação não são alterados por esse fluxo. Antes da atualização,
`saveAccount` confirma que a conta superior é sintética e percorre seus
ancestrais para impedir ciclos na árvore.

`components/users-manager.tsx`, `works-manager.tsx` e `assets-manager.tsx`
reutilizam o padrão cliente de seleção e alteração de Pessoas. As páginas
servidoras limitam as consultas a 20 registros, normalizam a página solicitada e
fornecem totais para a navegação. As ações `saveUser`, `saveWork` e `saveAsset`
distinguem criação e atualização pelo identificador oculto e auditam ambas.
`saveUser` troca perfil e dados do usuário em transação; uma senha vazia na
alteração não modifica `passwordHash`.

`Company` é o cadastro mestre usado pelas relações de obras e compras de
combustível. `Work.companyId = null` representa uma obra própria; uma empresa
com `isFuelSupplier = true` fica disponível como fornecedora em Combustível. A
migration `20260827141000_unify_companies` renomeia a antiga tabela `Supplier`,
preserva seus identificadores e compras, cria empresas para os textos legados
de `Work.client` e substitui o texto pela chave estrangeira.

## Domínios de dados

O schema possui 28 modelos, agrupados assim:

- Identidade: `Person`, `JobFunction`, `Activity`, `PersonActivity`, `User`, `Role`,
  `Permission`, `UserRole`, `RolePermission` e `AuditLog`.
- Cadastros e operação: `Company`, `SystemSettings`, `Work`, `EquipmentType` e
  `Asset`.
- Contabilidade: `Account`, `AccountingEntry`, `AccountingLine`,
  `AccountingPeriod`, `MonthlyClosing` e `EntryType`.
- Combustível: `FuelType`, `FuelPurchase` e `FuelDispense`.
- Estoque: `Product` e `StockMovement`.
- Manutenção: `MaintenanceOrder` e `MaintenancePart`.

Valores monetários e quantidades usam `Decimal` no PostgreSQL/Prisma. Datas de
lançamento inseridas pela interface são normalizadas para meio-dia UTC, evitando
mudança do dia ao exibir no fuso brasileiro. Competências usam o primeiro dia do
mês em UTC.

`AccountingEntry` armazena o primeiro período em `startAt`/`endAt` e, quando
necessário, um segundo período anulável em `secondStartAt`/`secondEndAt`. A ação
de gravação valida pares completos, ordem e ausência de sobreposição e persiste
em `hours` a soma decimal dos dois intervalos. Registros com apenas o primeiro
período e registros legados sem horários permanecem válidos.

`SystemSettings` é um singleton identificado por `default`. Além dos dados
institucionais, guarda a imagem de relatórios como `Bytes` e seu MIME type no
PostgreSQL. A rota autenticada `/api/configuracoes/imagem-relatorio` entrega o
binário com `nosniff`; uploads aceitam somente PNG, JPEG e WebP, limitados a 2
MB. `components/report-header.tsx` centraliza o cabeçalho imprimível e mantém a
imagem à esquerda.

`/relatorios/centro-custos` é uma página autenticada por `accounting.manage` e
consulta lançamentos por obra ativa e competência. O modo resumido agrega
quantidade, horas e valor no servidor; o modo detalhado exibe lançamentos,
contas, horários e totais. A impressão usa CSS específico para remover filtros,
menu e ações, preservando o cabeçalho institucional.

## Autenticação e autorização

- A autenticação usa e-mail e senha com `bcrypt`, custo 12.
- A sessão é um JWT HS256 no cookie `terracusto_session`, com validade de 8
  horas, `HttpOnly`, `SameSite=Lax`, caminho `/` e `Secure` em produção.
- `AUTH_SECRET` assina os tokens. O fallback presente no código serve somente
  para desenvolvimento; produção deve sempre definir uma chave forte.
- A autorização consulta as permissões ligadas aos perfis do usuário em cada
  entrada protegida e em cada Server Action.
- O login permite até oito falhas por IP em uma janela de 15 minutos.

O limitador atual usa memória do processo. Ele é reiniciado junto com a
aplicação e não é compartilhado se houver múltiplas instâncias. Se a aplicação
for escalada horizontalmente, substituir por um armazenamento compartilhado
(por exemplo, Redis ou tabela com expiração).

## Segurança operacional

O Next.js envia HSTS, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, política de referência restrita e desabilita
câmera, microfone e geolocalização. O cabeçalho identificador do framework está
desabilitado.

O serviço systemd usa usuário dedicado, `NoNewPrivileges`, `PrivateTmp` e
`ProtectSystem=full`. Segredos não fazem parte do build ou do Git.

Pontos a preservar em futuras alterações:

- toda escrita deve repetir a autorização no servidor, mesmo que o botão esteja
  oculto na interface;
- alterações financeiras devem respeitar `assertOpen` e preferir transações;
- ações relevantes devem chamar `audit` depois da conclusão;
- migrations de produção devem ser aditivas e precedidas de backup;
- nunca usar `prisma db push` em produção;
- não incluir `.env`, dumps, credenciais nem dados pessoais em commits/logs.

`assertOpen` é a barreira central das competências: usa o calendário de
`America/Bahia`, rejeita datas futuras, impede datas fora do mês operacional e
bloqueia obras com competência vencida. Não contorne essa função em novas ações
que criem ou alterem `AccountingEntry`. Na edição, a ação valida tanto a
competência original quanto a competência de destino e substitui as linhas de
débito e crédito na mesma atualização transacional do Prisma.

## PWA

O manifesto configura modo `standalone`, nome, cores e ícone. O service worker
armazena apenas o manifesto, ícone e arquivos versionados de `/_next/static`.
Páginas e dados autenticados não são cacheados para uso offline. Ao alterar a
estratégia ou ativos do service worker, incremente `terracusto-static-v1` para
invalidar caches antigos.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma |
| `AUTH_SECRET` | Assinatura dos tokens de sessão |
| `ADMIN_EMAIL` | Administrador criado pelo seed e login do smoke test |
| `ADMIN_PASSWORD` | Senha inicial do seed e login do smoke test |
| `NEXT_PUBLIC_APP_URL` | URL base usada pelo smoke test |
| `NODE_ENV` | Ativa cookie seguro e modo de produção |
| `PORT` | Porta do processo Next.js; produção usa `3120` |

## Limites conhecidos da versão inicial

- Não há testes unitários ou de integração; a cobertura automatizada atual é
  typecheck, build e smoke test.
- O tratamento de erros de formulários depende da resposta padrão das Server
  Actions; não há mensagens amigáveis para todas as falhas.
- Não há edição, exclusão ou inativação pela interface para a maioria dos
  cadastros.
- Não há recuperação de senha, segundo fator ou encerramento centralizado de
  sessões já emitidas.
- O JWT guarda nome e e-mail até expirar; mudanças nesses campos não atualizam
  uma sessão já aberta.
- O saldo de combustível não distingue tanque/local/obra.
- Peças de manutenção existem no schema, mas não estão integradas ao estoque na
  interface.
- O backup é local à mesma VPS; para recuperação de desastre, deve existir uma
  cópia externa testada.
