# Guia funcional

## Módulos e acessos

| Rota | Módulo | Permissão | Funções atuais |
| --- | --- | --- | --- |
| `/` | Visão geral | `dashboard.view` | Indicadores do mês e últimos lançamentos |
| `/pessoas` | Pessoas | `people.manage` | Pessoas, funções, atividades, edição e vínculos |
| `/usuarios` | Usuários e acessos | `users.manage` | Cadastro, edição e paginação de usuários; perfis personalizados |
| `/empresas` | Empresas | `companies.manage` | Cadastro único de clientes e fornecedores de combustível |
| `/obras` | Obras | `works.manage` | Cadastro, edição e paginação de centros de custo/obras |
| `/equipamentos` | Equipamentos | `assets.manage` | Tipos, cadastro, edição e paginação de ativos |
| `/configuracoes` | Configurações da empresa | `settings.manage` | Dados da empresa usuária e imagem dos relatórios |
| `/ajuda` | Manuais de ajuda | `help.manage` | Criação, edição, imagens e ordenação de guias por módulo |
| `/plano-contas` | Plano de contas | `accounting.manage` | Contas sintéticas e analíticas |
| `/tipos-lancamento` | Tipos de lançamento | `accounting.manage` | Configuração das contas padrão dos tipos |
| `/lancamentos` | Centro de custos | `accounting.manage` | Partidas balanceadas por obra |
| `/relatorios/centro-custos` | Relatório de centro de custo | `accounting.manage` | Resumo, detalhamento e opções contabilizadas por obra e competência, com impressão |
| `/fechamentos` | Fechamentos | `closing.close` | Fechamento e balancete mensal |
| `/fechamentos` | Reabertura | `closing.reopen` | Reabertura com senha e justificativa |
| `/combustivel` | Combustível | `fuel.manage` | Fornecedores, compras, tanque e abastecimentos |
| `/almoxarifado` | Almoxarifado | `stock.manage` | Produtos, entradas, saídas e ajustes positivos |
| `/manutencao` | Manutenção | `maintenance.manage` | Abertura e conclusão de ordens de serviço |
| `/perfil` | Minha conta | Usuário autenticado | Troca de senha |

Usuários sem sessão são redirecionados para `/login`. Usuários autenticados sem
a permissão exigida são redirecionados para `/sem-permissao`.

O menu lateral possui submenus expansíveis e mostra somente opções autorizadas:

- **Cadastros:** Pessoas, Usuários e acessos, Empresas, Obras, Equipamentos e
  Configurações da empresa;
- **Contabilidade:** Plano de contas, Tipos de lançamento, Centro de custos e
  Fechamentos;
- **Operacional:** Combustível, Almoxarifado e Manutenção.

As janelas de exibição dos Manuais de ajuda têm altura fixa de 80% da tela. O
conteúdo de cada passo é rolado dentro da janela, sem redimensionar a ajuda.

“Visão geral” permanece como acesso direto. Ao entrar em uma página, o grupo
correspondente abre automaticamente e destaca o subitem atual. Cada grupo pode
ser expandido ou contraído pelo clique e expõe seu estado para tecnologias
assistivas.

Na barra lateral, cada usuário pode escolher seu próprio tema de aparência:
Verde terra, Azul oceano, Areia dourada, Violeta ou Grafite. A escolha é aplicada
imediatamente e permanece salva para os próximos acessos daquele usuário.

Quando uma página possui manual de ajuda ativo e com passos, ela mostra o botão
“Ajuda”. O guia abre em uma janela com título, progresso, texto e imagens do
passo, além de Anterior, Próximo e Concluir. Administradores criam os manuais em
“Manuais de ajuda”, definindo página, situação, passos, textos e imagens.

## Perfis iniciais

O seed mantém dois perfis:

- `ADMIN` (Administrador): recebe todas as permissões.
- `CLERK` (Escriturário): recebe todas, exceto `users.manage`,
  `closing.reopen` e `settings.manage`.

Novos perfis podem ser criados na tela de usuários escolhendo qualquer
combinação das 14 permissões. Usuários existentes podem ter nome, e-mail,
perfil, vínculo com pessoa e senha alterados; deixar a nova senha vazia preserva
a credencial atual. Perfis ainda não possuem edição, desativação ou exclusão.

### Cadastros operacionais

- As listagens de Usuários e acessos, Empresas, Obras e Equipamentos apresentam
  até 20 registros por página e mostram a quantidade total cadastrada.
- Clicar ou usar Enter/Espaço em uma linha carrega o registro no formulário,
  destaca a seleção e ativa o modo de alteração. Cancelar ou salvar retorna o
  formulário ao modo de novo cadastro.
- A edição de usuário permite alterar nome, e-mail, perfil e vínculo com pessoa.
  A senha é opcional na alteração e somente é substituída quando preenchida.
- Empresas formam um cadastro único para clientes de obras e fornecedores de
  combustível. Cada empresa pode ser marcada como fornecedora de combustível e
  ativada ou inativada pela edição.
- A edição de obra preserva o código autoincrementável e a competência; permite
  alterar nome, empresa/cliente, descrição e data inicial. Sem empresa
  selecionada, a obra é identificada como “Obra própria”.

### Configurações e relatórios

- A configuração única da empresa usuária guarda razão social, CNPJ, endereço,
  telefone, responsável e telefone do responsável.
- A imagem dos relatórios aceita PNG, JPEG ou WebP de até 2 MB e fica armazenada
  no próprio banco. Um novo envio substitui a imagem anterior; a remoção precisa
  ser marcada explicitamente.
- A imagem só é entregue a usuários autenticados. O cabeçalho padrão dos
  relatórios posiciona a imagem à esquerda, os dados da empresa ao centro e o
  título à direita, com adaptação para impressão e telas menores.
- O relatório de centro de custos permite escolher uma obra ativa, uma ou várias
  competências disponíveis e o formato resumido ou detalhado. O resumo agrupa
  quantidade de lançamentos, horas e valor por competência; o detalhado lista
  cada lançamento, horários, contas e valor. O botão de impressão oculta os
  filtros e a navegação.
- A edição de equipamento permite alterar tipo, identificador, descrição,
  marca, modelo, combustível e consumo esperado.

## Regras principais

### Contabilidade

- Tipos de lançamento possuem cadastro livre, situação e contas devedora e
  credora padrão. Ao selecionar um tipo, as contas são preenchidas
  automaticamente, mas continuam editáveis no lançamento.
- O cadastro, a listagem e a manutenção dos tipos ficam na página exclusiva
  `/tipos-lancamento`. O Centro de custos contém somente o fluxo operacional de
  lançamento e sua listagem por obra.
- Tipos já utilizados são desativados em vez de apagados, preservando o
  histórico. Tipos sem utilização podem ser excluídos definitivamente.
- Ao criar uma conta analítica diretamente sob `3.1 — Serviços` ou
  `3.2 — Despesas reembolsáveis`, o sistema cria automaticamente um tipo de
  mesmo nome, com `1.2 — Clientes` como conta devedora padrão.
- O escriturário seleciona uma obra no Centro de custos. A escolha é guardada no
  navegador e permanece como padrão nos lançamentos seguintes.
- Cada obra possui uma competência operacional. No mês vigente, a data pode ir
  do primeiro dia do mês até a data atual; datas futuras são proibidas.
- Quando o calendário avança e a competência anterior continua aberta, a obra é
  bloqueada para qualquer novo lançamento.
- A tela informa o bloqueio e direciona ao fechamento. Somente a competência
  vencida mais antiga da obra pode ser fechada.
- Ao fechar a última competência vencida, o sistema cria ou libera
  automaticamente a competência do mês vigente.
- Cada lançamento pertence a uma obra e gera exatamente uma linha de débito e
  uma de crédito pelo mesmo valor.
- Na interface de lançamentos, essas posições são apresentadas como “Conta
  devedora” e “Conta credora”, respectivamente.
- Somente contas analíticas, ativas e distintas podem receber lançamentos.
- O campo Histórico é opcional nos lançamentos do Centro de custos, tanto no
  cadastro quanto na alteração.
- A listagem do plano de contas é exibida como uma árvore hierárquica. Contas
  sintéticas usam ícone de pasta e funcionam como grupos que podem ser
  expandidos ou contraídos; contas analíticas usam ícone de documento. A tela
  inicia com todos os grupos contraídos e também oferece as ações “Expandir
  tudo” e “Contrair tudo”.
- Cada conta possui a ação “Editar”. A alteração permite mudar o nome e a conta
  superior, mantendo código, natureza e classificação sintética/analítica. O
  sistema impede que uma conta seja movida para dentro dela mesma ou de uma de
  suas descendentes.
- A competência é o primeiro dia UTC do mês da data informada.
- O primeiro período de trabalho é opcional e usa hora de início e hora final.
  Um segundo período também pode ser informado para jornadas com intervalo,
  como manhã e tarde. Cada período preenchido exige as duas horas, o final deve
  ser posterior ao início e o segundo período não pode começar antes do término
  do primeiro. A duração destacada em azul é a soma dos períodos informados.
- Para lançamentos em grupo, depois de contabilizar ou salvar uma alteração o
  formulário preserva obra, data, tipo, histórico, documento, contas,
  equipamento e pessoa. Somente valor cobrado e as horas dos dois períodos são
  limpos, e o formulário retorna ao modo de novo lançamento.
- Cada tipo de lançamento informa se envolve equipamento, operador/motorista ou
  ambos. Ao selecionar um tipo sem essas referências, o grupo de equipamento e
  jornada não é exibido. Quando a referência é exigida, o respectivo campo passa
  a ser obrigatório.
- O formulário fica organizado em três grupos: **Obra e lançamento** (obra,
  competência, data, histórico opcional, documento e valor), **Classificação
  contábil** (tipo e contas) e, quando necessário, **Equipamento e jornada**
  (equipamento, operador, os dois períodos e total de horas).
- A listagem do Centro de custos mostra somente os lançamentos da obra
  selecionada, em páginas de até 20 registros. Ao clicar ou usar Enter/Espaço
  em uma linha, o lançamento é carregado para edição. Os controles Anterior e
  Próxima permanecem visíveis e ficam desabilitados quando não há outra página.
- A listagem pode ser filtrada por uma data específica ou por período (data
  inicial e final) e por conta. O filtro de conta localiza a conta tanto quando
  ela é devedora quanto quando é credora; os filtros permanecem ao trocar de
  página.
- O Relatório de centro de custo mantém as opções Resumo por competência e
  Detalhado. Também oferece Contabilizado resumido por conta e Contabilizado
  detalhado por conta. Nesses formatos, o saldo de cada conta respeita sua
  natureza: devedora calcula débitos menos créditos; credora calcula créditos
  menos débitos.
- A edição recria as duas linhas contábeis balanceadas e respeita as mesmas
  regras de competência, data, tipo e contas de um lançamento novo. Compras de
  combustível não podem ser editadas pelo Centro de custos.
- Uma competência fechada não aceita novos lançamentos nem compras de
  combustível vinculadas àquela obra. As mesmas regras de competência e data
  futura são verificadas no servidor para compras que geram lançamento.
- O fechamento é transacional, com isolamento serializável. Para cada conta
  analítica movimentada, grava saldo anterior, débitos, créditos e saldo final.
- Contas de natureza devedora calculam `anterior + débito - crédito`; contas de
  natureza credora calculam `anterior + crédito - débito`.
- A reabertura apaga a consolidação daquela obra/competência, reabre o período e
  exige a senha do usuário mais justificativa de ao menos cinco caracteres. Se
  a competência reaberta já venceu, a obra volta a ficar bloqueada até um novo
  fechamento.

### Combustível

- Fornecedores de combustível são empresas ativas marcadas para essa finalidade
  no cadastro `/empresas`; não existe um cadastro de postos separado.
- Tipos de combustível possuem CRUD próprio com nome, preço de referência e
  situação. Registros sem uso são removidos; registros já vinculados a
  equipamentos, compras ou abastecimentos são desativados para preservar o
  histórico e podem ser reativados pela edição.
- A compra calcula `litros × preço unitário`, arredonda para duas casas e cria,
  na mesma transação, o lançamento contábil correspondente.
- O saldo do tanque é global por tipo de combustível: total comprado menos
  total abastecido. No modelo atual ele não é separado por obra ou tanque.
- Um abastecimento exige combustível, equipamento e obra, e pode registrar
  operador, horímetro/odômetro e observação.
- Não é permitida saída maior que o saldo calculado.

### Almoxarifado

- Produtos possuem código único, unidade e estoque mínimo.
- O saldo considera entradas e ajustes como positivos e saídas como negativas.
- Uma saída não pode ultrapassar o saldo disponível.
- O tipo `ADJUSTMENT` disponível na interface é sempre um ajuste positivo.
- Movimentações podem ser vinculadas a obra, documento e solicitante.

### Manutenção

- Ordens são numeradas automaticamente e podem ser preventivas ou corretivas.
- Na abertura são aceitos equipamento, obra, responsável, medidor e solicitação.
- A interface atual leva a ordem diretamente de aberta para concluída; os
  estados intermediários existem no banco, mas ainda não têm ação própria.
- A conclusão registra diagnóstico, serviço, custo externo e data final.
- A estrutura de banco prevê peças por ordem, mas a interface atual ainda não
  cadastra `MaintenancePart` nem baixa essas peças do estoque.

### Pessoas, obras e equipamentos

- CPF de pessoa, nome da função, código da obra e identificador do equipamento
  são únicos.
- Pessoas podem ser funcionários, terceirizados ou outros. Cada pessoa pode ter
  uma função cadastrada e várias atividades.
- A listagem é ordenada por nome e paginada em até 20 pessoas. Ao passar o mouse
  ou navegar pelo teclado, a linha é destacada; ao selecioná-la, o formulário é
  preenchido e muda do modo de cadastro para o modo de alteração. Depois que a
  alteração é salva com sucesso, o formulário é limpo e retorna automaticamente
  ao modo de novo cadastro.
- Cada obra funciona como centro de custo dos lançamentos operacionais.
- O código da obra é numérico, único e gerado automaticamente pelo banco em
  ordem crescente; ele não é informado pelo usuário.
- Equipamentos podem ter tipo de combustível e consumo esperado. O consumo
  esperado é armazenado, mas ainda não gera alertas ou relatórios.
- Tipos de equipamento são mantidos em um catálogo próprio. Cada equipamento
  exige um tipo ativo, evitando variações de texto no cadastro.

## Dados iniciais do seed

O seed é idempotente e cria/atualiza:

- as 12 permissões e os perfis `ADMIN` e `CLERK`;
- as funções Administrativo, Auxiliar, Mecânico, Motorista e Operador de
  máquinas;
- os tipos de equipamento Máquina, Veículo, Ferramenta e Outro;
- o plano inicial: ativo, caixa e bancos, clientes, estoque de combustível,
  passivo, fornecedores, receitas, receita de serviços, custos/despesas,
  combustíveis, manutenção, materiais e serviços de terceiros;
- as contas sintéticas `3.1 — Serviços` e `3.2 — Despesas reembolsáveis`, as
  analíticas `3.1.1 — Serviços de máquinas`, `3.2.1 — Reembolso de alimentação`
  e `4.5 — Alimentação`;
- os tipos Serviço de máquinas (`Clientes × Serviços de máquinas`), Reembolso
  de alimentação (`Clientes × Reembolso de alimentação`) e Alimentação paga
  (`Alimentação × Caixa e bancos`);
- Diesel S10, Diesel S500, Gasolina e Etanol;
- atividades básicas de escavadeira, retroescavadeira, caminhão e mecânica;
- o administrador configurado nas variáveis de ambiente.

`3.2 — Despesas reembolsáveis` fica no grupo de receitas e reúne valores
cobrados do cliente; o gasto efetivo permanece em uma conta de custo, como
`4.5 — Alimentação`. A classificação fiscal e a emissão da nota devem ser
confirmadas com o contador: a Receita Federal já tratou custos/despesas
faturados ao tomador como parte do preço e da receita bruta em situações de
prestação de serviços ([Cosit 26/2025](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=78212)
e [Cosit 72/2020](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=57003)).

## Auditoria

As ações de login, logout, troca de senha, criação, atribuição, fechamento,
reabertura e conclusão registram usuário, ação, entidade, identificador, data e,
quando aplicável, justificativa. O modelo aceita IP e dados JSON, porém as ações
atuais não preenchem esses dois campos. Ainda não existe uma tela de consulta de
auditoria.
