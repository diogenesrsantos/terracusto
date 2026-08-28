# Inventário completo do TerraCusto

Este documento consolida o funcionamento conhecido do sistema em 26/08/2026.
Ele deve ser lido junto com o [guia funcional](GUIA-FUNCIONAL.md), a
[arquitetura](ARQUITETURA.md), o [estado implantado](ESTADO-ATUAL.md) e o
[manual operacional](../deployment/README.md). O schema Prisma e o código
continuam sendo a fonte executável; este inventário é a referência humana para
manutenções futuras.

Não são registrados aqui senhas, segredos, documentos pessoais, dados de
clientes nem conteúdo das variáveis de ambiente.

## Identificação e finalidade

- Produto: TerraCusto.
- Finalidade: administrar obras de terraplenagem, equipes, máquinas, custos,
  receitas, combustível, estoque e manutenção.
- Aplicação: PWA web responsiva, com área autenticada.
- Idioma e regras de calendário: português do Brasil e fuso
  `America/Bahia`.
- Produção: `https://terracusto.provizi.net.br`.
- Stack: Next.js 16.3.3, React 19, TypeScript 5, Prisma 6.12 e PostgreSQL.
- Repositório/branch consolidada: `feat/evolucoes-operacionais`; confirme o
  commit vigente com `git rev-parse HEAD`.
- Evoluções locais posteriores ao commit consolidado são registradas em
  `docs/ESTADO-ATUAL.md` antes da implantação.

## Mapa funcional

| Rota | Nome exibido | Permissão | Recursos disponíveis |
| --- | --- | --- | --- |
| `/` | Visão geral | `dashboard.view` | Quantidade de obras e equipamentos, débitos do mês, manutenções abertas e oito lançamentos recentes |
| `/pessoas` | Pessoas | `people.manage` | Cadastro e edição de pessoas, catálogo de funções, atividades e vínculo pessoa/atividade |
| `/usuarios` | Usuários | `users.manage` | Cadastro, edição e paginação de usuários, vínculo com pessoa, perfil e criação de perfis personalizados |
| `/empresas` | Empresas | `companies.manage` | Cadastro, edição e paginação do catálogo compartilhado por obras e combustível |
| `/obras` | Obras | `works.manage` | Cadastro, edição e paginação de obras/centros de custo |
| `/equipamentos` | Equipamentos | `assets.manage` | Cadastro de tipos e cadastro, edição e paginação de equipamentos/ativos |
| `/configuracoes` | Configurações da empresa | `settings.manage` | Dados institucionais, upload da imagem e prévia do cabeçalho dos relatórios |
| `/plano-contas` | Plano de contas | `accounting.manage` | Cadastro e listagem hierárquica de contas |
| `/tipos-lancamento` | Tipos de lançamento | `accounting.manage` | Cadastro, edição, situação, exclusão e contas padrão dos tipos |
| `/lancamentos` | Centro de custos | `accounting.manage` | Lançamentos balanceados, paginação, filtro por obra e edição |
| `/relatorios/centro-custos` | Relatório de centro de custo | `accounting.manage` | Seleção de obra/competências, resumo, detalhamento e impressão |
| `/fechamentos` | Fechamentos | `closing.close` | Fechamento de competências vencidas e balancete |
| `/fechamentos` | Reabertura | `closing.reopen` | Reabertura mediante senha e justificativa |
| `/combustivel` | Combustível | `fuel.manage` | Tipos, fornecedores, compras, saldo do tanque e abastecimentos |
| `/almoxarifado` | Almoxarifado | `stock.manage` | Produtos, entradas, saídas, ajustes positivos, saldos e alerta de reposição |
| `/manutencao` | Manutenção | `maintenance.manage` | Abertura e conclusão de ordens preventivas/corretivas |
| `/perfil` | Minha senha | usuário autenticado | Alteração da própria senha |
| `/sem-permissao` | Acesso não autorizado | usuário autenticado | Aviso de falta de permissão |
| `/api/health` | Health check | público | Estado da aplicação e teste simples do banco |

O menu lateral só mostra módulos permitidos ao usuário. A autorização é
repetida no servidor em todas as páginas protegidas e ações de escrita.

A navegação é agrupada em submenus expansíveis: Cadastros reúne Pessoas,
Usuários e acessos, Empresas, Obras, Equipamentos e Configurações da empresa; Contabilidade reúne Plano de contas,
Tipos de lançamento, Centro de custos e Fechamentos; Operacional reúne
Combustível, Almoxarifado e Manutenção. Visão geral é um item direto. O grupo da rota atual abre
automaticamente, o subitem recebe destaque e os gatilhos são acessíveis por
teclado e tecnologias assistivas. Grupos sem nenhum item permitido são
omitidos.

O seletor de tema na barra lateral oferece cinco paletas de cores. A preferência
é individual, armazenada em `User.theme` e validada pelo servidor antes de ser
gravada; a alteração é auditada como `UPDATE_THEME`.

## Fluxos e regras por módulo

### Pessoas e acesso

- Pessoa possui nome, CPF opcional e único, contato, tipo, função cadastrada,
  observações, situação e várias atividades.
- Tipos de pessoa: funcionário, terceirizado ou outro.
- A listagem de pessoas é alfabética e possui até 20 registros por página.
- Passar o mouse, focar pelo teclado ou selecionar uma linha destaca o item.
  A seleção carrega o cadastro no formulário e ativa o modo de alteração.
- Depois de salvar uma alteração, o formulário é limpo e volta ao modo de novo
  cadastro.
- Funções são registros estruturados (`JobFunction`), não texto livre.
- Usuário pode ser vinculado a uma pessoa e pode possuir vários perfis no banco;
  o formulário atribui um perfil no cadastro e na alteração.
- A senha inicial aceita no formulário possui no mínimo oito caracteres. A
  troca da própria senha exige a senha atual, confirmação e no mínimo dez
  caracteres.
- Usuários são listados alfabeticamente em páginas de até 20 registros. A linha
  selecionada carrega nome, e-mail, perfil e vínculo com pessoa para alteração.
  A nova senha é opcional e, quando vazia, preserva o hash existente.
- O sistema inicializa os perfis Administrador e Escriturário. O Administrador
  recebe todas as 12 permissões; o Escriturário não recebe `users.manage` nem
  `closing.reopen`.

### Obras e equipamentos

- Empresa possui nome, CNPJ/CPF opcional e único, situação e indicação de que
  atua como fornecedora de combustível. O mesmo registro pode ser selecionado
  como cliente de obra e fornecedor.
- Obra possui código inteiro único gerado por sequência/autoincremento, nome,
  empresa/cliente opcional, descrição e data inicial opcional. A ausência da
  empresa representa “Obra própria”.
- Uma competência aberta para o mês vigente é criada junto com cada obra.
- Obra é o centro de custo obrigatório de lançamentos e operações de
  combustível; pode também ser vinculada a estoque e manutenção.
- Equipamento exige tipo ativo, identificador/placa único e descrição. Marca,
  modelo, combustível e consumo esperado são opcionais.
- O identificador é convertido para maiúsculas e aceita somente letras,
  números e hífen.
- Tipos de equipamento são um catálogo livre. A interface atual cria e lista,
  mas não edita nem exclui esses tipos.
- Obras e equipamentos possuem listagens paginadas de até 20 registros, seleção
  acessível por mouse ou teclado e formulário compartilhado entre cadastro e
  alteração. O código da obra permanece imutável; todos os campos cadastrais do
  equipamento podem ser atualizados.

### Plano de contas e tipos de lançamento

- Conta possui código único, nome, natureza devedora/credora, classificação
  sintética/analítica, situação e conta superior opcional.
- A listagem usa um TreeView construído pelos vínculos `parentId`. Conta
  sintética é representada por pasta dourada e pode expandir/contrair seus
  descendentes; conta analítica usa documento verde. Todos os grupos começam
  contraídos e podem ser controlados em conjunto por “Expandir tudo” e
  “Contrair tudo”. A estrutura possui semântica acessível de árvore.
- A ação “Editar” permite alterar nome e conta superior. Código, natureza e tipo
  permanecem bloqueados para proteger a classificação contábil. Contas
  analíticas só podem pertencer a grupos sintéticos, e nenhuma conta pode ser
  colocada dentro dela mesma ou de suas descendentes.
- Somente contas analíticas, ativas e distintas podem ser usadas nas partidas
  criadas pelo Centro de custos.
- Tipo de lançamento é um cadastro livre com nome único, situação e contas
  devedora e credora padrão. As contas são sugeridas ao selecionar o tipo, mas
  podem ser trocadas no lançamento.
- A manutenção dos tipos utiliza uma página contábil própria. Isso mantém o
  Centro de custos dedicado à rotina frequente de lançar e consultar registros.
- Tipo sem uso pode ser excluído. Se já foi usado, a exclusão solicitada apenas
  o desativa para preservar o histórico.
- Ao cadastrar uma conta analítica diretamente sob `3.1 — Serviços` ou
  `3.2 — Despesas reembolsáveis`, o sistema assegura automaticamente um tipo
  de lançamento de mesmo nome, com débito padrão em `1.2 — Clientes` e crédito
  na conta criada.
- O caso de prestação de serviço usa normalmente Clientes como conta devedora e
  uma receita analítica de serviços como credora. Reembolsos cobrados do cliente
  usam Clientes contra uma receita analítica de despesas reembolsáveis. O gasto
  efetivo é lançado separadamente em uma conta de custo/despesa contra caixa,
  banco ou fornecedor.

### Centro de custos

- Cada lançamento pertence a uma obra e a um tipo ativo e gera exatamente duas
  linhas de mesmo valor: uma de débito e uma de crédito.
- Campos: obra, competência exibida, data, tipo, histórico opcional, documento,
  contas, valor, equipamento opcional, pessoa opcional, primeiro período e
  segundo período opcional.
- A obra selecionada é persistida no navegador na chave
  `terracusto.defaultWorkId` e também fica na URL como `workId`.
- Para lançamentos em grupo, após criar ou alterar um registro o formulário
  mantém obra, data, tipo, histórico, documento, contas, equipamento e pessoa.
  Somente valor cobrado e os horários dos dois períodos são limpos.
- A apresentação agrupa o formulário em cinco linhas: obra/competência;
  equipamento/operador; data, horários e total; histórico/documento/valor; tipo
  e contas.
- As cinco linhas aparecem dentro de três caixas visuais: Obra e equipe, Jornada
  e valores e Classificação contábil.
- Os horários recebem apenas `HH:mm`; não se informa outra data. Cada período
  preenchido exige início e final, e o segundo período só pode existir junto do
  primeiro. O final deve ser posterior ao início, os períodos não podem se
  sobrepor e a duração total é a soma em horas decimais. Um lançamento com
  somente o primeiro período continua válido.
- A listagem é filtrada pela obra selecionada, ordenada por data/criação
  decrescente e paginada em até 20 registros. Anterior e Próxima ficam sempre
  visíveis e são desabilitados quando não se aplicam.
- Clicar ou usar Enter/Espaço em uma linha carrega o lançamento para alteração.
  Depois de salvar, o modo volta para novo lançamento.
- Na edição, as linhas contábeis anteriores são removidas e recriadas dentro da
  atualização Prisma. A competência original e a competência de destino são
  validadas. Lançamentos originados por compra de combustível não são editáveis
  nessa tela.

### Competências, fechamento e reabertura

- A competência é mensal por obra e armazenada como o primeiro dia do mês em
  UTC.
- Um lançamento novo ou alterado só pode usar uma data entre o primeiro dia do
  mês vigente e o dia atual; datas futuras são bloqueadas.
- Se existir competência anterior aberta, a obra fica bloqueada até que ela seja
  fechada. A mais antiga deve ser fechada primeiro.
- O fechamento usa transação com isolamento serializável. Para cada conta
  analítica ativa, calcula saldo anterior, débitos, créditos e saldo final;
  registros zerados sem saldo anterior são omitidos.
- Natureza devedora: `saldo anterior + débitos - créditos`.
- Natureza credora: `saldo anterior + créditos - débitos`.
- Depois da última competência vencida, a competência do mês atual é criada ou
  liberada automaticamente.
- Reabrir remove a consolidação daquele mês, muda o período para aberto, exige
  a senha do usuário e justificativa com pelo menos cinco caracteres e registra
  a justificativa na auditoria.

### Combustível

- Tipos de combustível possuem nome único, preço de referência opcional e
  situação. Podem ser criados, editados, ativados, desativados e excluídos.
- Um tipo referenciado por equipamento, compra ou abastecimento é desativado em
  vez de excluído.
- Fornecedores são empresas ativas marcadas como fornecedoras de combustível.
- Compra registra data, cupom/nota, fornecedor, combustível, litros, preço unitário,
  obra e contas. O total é `litros × preço`, arredondado para duas casas.
- Compra e lançamento contábil correspondente são criados na mesma transação.
  A compra respeita a competência operacional da obra e não pode usar
  combustível inativo.
- O saldo do tanque é global por tipo: total comprado menos total abastecido.
- Abastecimento registra data, combustível, litros, equipamento, obra e,
  opcionalmente, medidor, pessoa e observação. Não permite quantidade não
  positiva nem saída superior ao saldo global.
- A tela mostra até 50 compras e 50 abastecimentos recentes.

### Almoxarifado

- Produto possui código único em maiúsculas, descrição, unidade, estoque mínimo
  e situação.
- Movimentos: entrada, saída e ajuste. Na interface, ajuste é sempre positivo.
- Movimento pode conter data, quantidade, custo unitário, documento,
  solicitante, histórico e obra opcional.
- Saldo: entradas e ajustes somados, saídas subtraídas. Saída superior ao saldo
  é rejeitada.
- A tela sinaliza “Repor” quando o saldo é menor ou igual ao estoque mínimo e
  mostra até 100 movimentos recentes.

### Manutenção

- Ordem recebe número inteiro autoincrementável e tipo preventivo ou corretivo.
- Abertura registra equipamento, reclamação e, opcionalmente, obra, responsável
  e horímetro/odômetro.
- A interface atual permite concluir diretamente uma ordem aberta, registrando
  diagnóstico, serviço, custo externo e instante da conclusão.
- O banco prevê os estados aberta, em andamento, aguardando peça, concluída e
  cancelada, mas a interface ainda não opera todos esses estados.
- O banco prevê peças e custos por ordem, mas a interface ainda não cadastra
  peças nem gera baixa automática no almoxarifado.

O relatório de centro de custos consulta somente obras ativas e competências que
possuem lançamentos. O modo resumido soma quantidade, horas e valores por
competência; o detalhado apresenta cada lançamento e seus dois períodos de
horário quando existentes. O cabeçalho usa `ReportHeader` e a imagem armazenada
em `SystemSettings`.

## Modelo de dados

O schema possui 28 modelos:

| Grupo | Modelo | Responsabilidade e vínculos principais |
| --- | --- | --- |
| Identidade | `Person` | Pessoa operacional; função, atividades, usuário opcional, lançamentos, abastecimentos e manutenções |
| Identidade | `JobFunction` | Catálogo de funções associado a pessoas |
| Identidade | `Activity` | Catálogo de atividades/capacidades |
| Identidade | `PersonActivity` | Relação muitos-para-muitos entre pessoa e atividade |
| Identidade | `User` | Credencial, situação, pessoa opcional, perfis e auditoria |
| Identidade | `Role` | Perfil de acesso |
| Identidade | `Permission` | Permissão funcional identificada por código |
| Identidade | `UserRole` | Relação muitos-para-muitos usuário/perfil |
| Identidade | `RolePermission` | Relação muitos-para-muitos perfil/permissão |
| Identidade | `AuditLog` | Usuário, ação, entidade, identificador, motivo, JSON, IP e data |
| Cadastro | `Company` | Empresa compartilhada por obras e fornecedores de combustível |
| Configuração | `SystemSettings` | Dados únicos da empresa usuária e imagem binária dos relatórios |
| Operação | `Work` | Obra/centro de custo e seus períodos, lançamentos e operações |
| Operação | `EquipmentType` | Catálogo de tipos de equipamento |
| Operação | `Asset` | Máquina, veículo, ferramenta ou outro ativo |
| Contabilidade | `Account` | Plano hierárquico de contas, natureza e classificação |
| Contabilidade | `EntryType` | Tipo de lançamento e contas padrão |
| Contabilidade | `AccountingEntry` | Cabeçalho do lançamento por obra, tipo, pessoa/equipamento e horas |
| Contabilidade | `AccountingLine` | Linha de débito ou crédito vinculada a conta e lançamento |
| Contabilidade | `AccountingPeriod` | Estado aberto/fechado da competência por obra |
| Contabilidade | `MonthlyClosing` | Consolidação mensal por obra e conta |
| Combustível | `FuelType` | Catálogo, preço de referência e situação |
| Combustível | `FuelPurchase` | Entrada no tanque e vínculo individual com lançamento contábil |
| Combustível | `FuelDispense` | Saída do tanque para equipamento e obra |
| Estoque | `Product` | Item, unidade e estoque mínimo |
| Estoque | `StockMovement` | Entrada, saída ou ajuste, com obra opcional |
| Manutenção | `MaintenanceOrder` | Ordem numerada, equipamento, estado, serviços e custos |
| Manutenção | `MaintenancePart` | Peça, quantidade e custo vinculados à ordem |

Enums persistidos: `PersonType`, `EntryStatus`, `AccountNature`,
`StockMovementKind`, `MaintenanceKind`, `MaintenanceStatus` e `PeriodStatus`.
Valores monetários e quantitativos usam `Decimal`; identificadores internos usam
`cuid`, exceto códigos/números autoincrementáveis de obra e ordem.

## Escritas e auditoria

| Permissão/contexto | Ações de servidor |
| --- | --- |
| Sessão | `login`, `logout` e `changePassword` |
| `people.manage` | `createActivity`, `createJobFunction`, `assignActivity` e `savePerson` |
| `users.manage` | `saveUser` e `createRole` |
| `companies.manage` | `saveCompany` |
| `settings.manage` | `saveSystemSettings` |
| `works.manage` | `saveWork`, incluindo a competência inicial somente na criação |
| `assets.manage` | `createEquipmentType` e `saveAsset` |
| `accounting.manage` | `saveAccount`, `saveEntryType`, `deleteEntryType` e `saveEntry` |
| `closing.close` | `closePeriod` |
| `closing.reopen` | `reopenPeriod` |
| `fuel.manage` | `saveFuelType`, `deleteFuelType`, `createFuelPurchase` e `createFuelDispense` |
| `stock.manage` | `createProduct` e `createStockMovement` |
| `maintenance.manage` | `createMaintenance` e `finishMaintenance` |

As ações relevantes registram `CREATE`, `UPDATE`, `DELETE`, `DEACTIVATE`,
`ASSIGN`, `ENSURE_AUTO`, `CLOSE`, `REOPEN`, `FINISH`, `LOGIN`, `LOGOUT` ou
`CHANGE_PASSWORD` em `AuditLog`. Não há ainda uma tela de consulta da auditoria.

## Dados iniciais idempotentes

O seed cria/atualiza:

- 12 permissões e os perfis `ADMIN` e `CLERK`;
- administrador indicado por `ADMIN_EMAIL`, sem redefinir a senha de usuário já
  existente;
- funções Administrativo, Auxiliar, Mecânico, Motorista e Operador de máquinas;
- atividades de escavadeira, retroescavadeira, caminhão e mecânica;
- tipos de equipamento Máquina, Veículo, Ferramenta e Outro;
- combustíveis Diesel S10, Diesel S500, Gasolina e Etanol;
- plano inicial com Ativo, Caixa e bancos, Clientes, Estoque de combustível,
  Passivo, Fornecedores, Receitas, Serviços, Serviços de máquinas, Despesas
  reembolsáveis, Reembolso de alimentação, Custos e despesas, Combustíveis,
  Manutenção, Materiais, Serviços de terceiros e Alimentação;
- tipos Serviço de máquinas, Reembolso de alimentação e Alimentação paga.

## Histórico de banco

| Migration | Resultado |
| --- | --- |
| `20260826173814_init` | Estrutura inicial |
| `20260826181500_add_job_functions` | Converte função em texto para catálogo preservando valores existentes |
| `20260826193000_autoincrement_work_code` | Converte código de obra para inteiro sequencial preservando a ordem existente |
| `20260826203000_add_equipment_types` | Substitui enum de equipamento por catálogo preservando os ativos |
| `20260826213000_add_fuel_type_active` | Adiciona situação aos combustíveis |
| `20260826223000_backfill_accounting_periods` | Cria períodos faltantes para lançamentos legados |
| `20260826233000_add_entry_types` | Reestrutura contas de serviços/reembolsos e cria tipos de lançamento |
| `20260827001000_sync_service_entry_types` | Cria tipos para contas analíticas já existentes sob Serviços/Reembolsáveis |
| `20260827141000_unify_companies` | Unifica clientes e fornecedores em `Company`, vincula obras e cria a permissão de empresas |
| `20260827174500_add_second_entry_period` | Adiciona um segundo período opcional aos lançamentos para registrar jornadas com intervalo |
| `20260827183000_add_system_settings` | Cria a configuração única da empresa, armazenamento da imagem e permissão administrativa |
| `20260828011500_add_user_theme` | Adiciona a preferência individual de tema à configuração de cada usuário |

Produção possui as onze primeiras migrations aplicadas. A décima segunda está
preparada localmente para armazenar os temas dos usuários e ainda requer backup
e implantação. Nunca usar `prisma db push` em produção; mudanças de schema devem
usar migration revisada e backup prévio.

## Segurança, sessão e PWA

- Senhas usam bcrypt com custo 12.
- Sessão JWT HS256 em cookie `terracusto_session`, validade de oito horas,
  `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Login limita oito falhas por IP em 15 minutos, em memória do processo.
- Cabeçalhos: HSTS, `nosniff`, `SAMEORIGIN`, referência restrita e bloqueio de
  câmera, microfone e geolocalização.
- PWA em modo standalone. O service worker guarda apenas manifesto, ícone e
  arquivos estáticos do Next.js; páginas/dados autenticados não ficam offline.
- Segredos ficam em `/etc/terracusto.env`; credenciais iniciais ficam fora do
  repositório. Nenhum dos dois deve ser copiado para logs ou documentação.

## Produção, operação e continuidade

- VPS: `provizi.net.br` (`191.252.178.248`).
- Aplicação: `/var/www/terracusto`, executada pelo usuário `terracusto`.
- Serviço: `terracusto.service`, porta local 3120, reinício automático.
- Proxy/TLS: Nginx e Let's Encrypt.
- Banco: PostgreSQL local, base `terracusto`.
- Health check: `GET /api/health` executa teste do banco.
- Backup: dump PostgreSQL customizado em `/var/backups/terracusto`, todos os
  dias às 02:30 com atraso aleatório de até 15 minutos e retenção de 14 dias.
- Último backup manual registrado: `terracusto-20260826-212050.dump`, 69.271
  bytes.
- Última validação registrada: builds local/remoto aprovados, oito migrations
  sem pendências, serviço ativo e health check de aplicação/banco `ok`.
- Backup local não protege contra perda integral da VPS; falta estabelecer cópia
  externa criptografada e teste periódico de restauração.

## Limites e pendências conhecidos

- Não há testes unitários ou de integração; existem typecheck, build e smoke
  test mínimo.
- O smoke autenticado não funciona com `ADMIN_PASSWORD` depois que o
  administrador troca sua senha; recomenda-se usuário técnico próprio.
- Erros de Server Actions ainda não possuem tratamento amigável uniforme.
- Perfis, tipos de equipamento, produtos, movimentos, compras e abastecimentos
  ainda não possuem edição pela interface.
- Não há recuperação de senha, segundo fator ou revogação central de JWTs.
- O limitador de login em memória não atende múltiplas instâncias.
- Não há tela de auditoria.
- Saldo de combustível não é separado por tanque, local ou obra.
- Abastecimento registra custo físico, mas não gera automaticamente lançamento
  contábil de consumo.
- Estoque não possui ajuste negativo específico nem integração com peças de
  manutenção.
- Estados intermediários/cancelamento de manutenção não estão disponíveis na
  interface.
- Não há relatórios analíticos além do painel, listas operacionais e balancete
  de fechamento.
- As evoluções implantadas foram reunidas na branch
  `feat/evolucoes-operacionais`; o hash atual deve ser conferido no Git antes de
  cada nova implantação.

## Regra de manutenção desta documentação

Em toda alteração futura:

1. atualizar o módulo e a regra afetados neste inventário e no guia funcional;
2. atualizar arquitetura quando houver nova decisão técnica ou modelo;
3. registrar migration, backup, build, deploy e validações no estado atual;
4. atualizar o manual operacional quando mudar infraestrutura ou procedimento;
5. nunca registrar segredos ou dados pessoais;
6. confirmar a documentação contra o código e o estado real da VPS.
