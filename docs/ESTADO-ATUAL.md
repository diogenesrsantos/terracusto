# Estado atual

Registro da implantação inicial, validado em **26/08/2026**, no fuso
`America/Bahia`.

O mapa consolidado do produto está em `docs/INVENTARIO-SISTEMA.md`. Ele registra
os módulos, fluxos, 27 modelos, ações, migrations, segurança, operação e limites
conhecidos sem incluir segredos ou dados pessoais.

Em 27/08/2026, o Centro de custos passou a aceitar um segundo período opcional
no mesmo lançamento, permitindo registrar manhã e tarde e somar ambas as
durações. Um único período continua funcionando. A migration
`20260827174500_add_second_entry_period` adicionou duas colunas anuláveis.

Implantação validada em 27/08/2026: backup pré-migration
`terracusto-20260827-144403.dump` (72.397 bytes), 10 migrations aplicadas sem
pendências, build remoto aprovado com 20 rotas, serviço ativo desde 14:46 -03 e
health check com aplicação e banco `ok`. O domínio público respondeu HTTP 307
para `/login`, com os cabeçalhos de segurança, e o timer de backup permaneceu
ativo.

Em 27/08/2026, a listagem do Plano de contas foi convertida em TreeView. Contas
sintéticas possuem ícone de pasta e controles de expansão; contas analíticas
possuem ícone de documento. A árvore respeita `Account.parentId`, inicia
contraída, permite expandir/contrair todos os grupos e inclui semântica ARIA e
adaptação responsiva. A alteração é somente de apresentação e não modifica o
banco.

Implantação validada em 27/08/2026: oito migrations sem pendências, builds
local/remoto aprovados, serviço ativo desde 08:41 -03 e health check com
aplicação e banco `ok`. O artefato publicado contém os controles do TreeView e
sua semântica ARIA. O domínio público respondeu HTTP 307 para `/login`, como
esperado sem sessão. Não foi necessário backup específico porque não houve
alteração de schema nem escrita de dados durante a implantação.

Na evolução seguinte, a árvore passou a iniciar completamente contraída e cada
linha recebeu a ação “Editar”. O formulário de alteração permite modificar nome
e conta superior, preserva código, natureza e tipo e rejeita uma conta superior
analítica ou qualquer vínculo que forme ciclo na hierarquia. A escrita usa
`saveAccount`, exige `accounting.manage`, registra `UPDATE` na auditoria e
invalida as telas que exibem nomes de contas.

Implantação validada em 27/08/2026: oito migrations sem pendências, builds
local/remoto aprovados, serviço ativo desde 09:06 -03 e health check com
aplicação e banco `ok`. O artefato contém o formulário de alteração e a
validação contra ciclos. Nenhuma conta foi modificada durante o deploy e não foi
necessário backup específico, pois não houve alteração de schema nem escrita
automática de dados.

Em 27/08/2026, o menu lateral foi reorganizado em submenus expansíveis:
Cadastros, Contabilidade e Operacional. Visão geral permanece como item direto.
O servidor filtra cada subitem pelas permissões do usuário e omite grupos
vazios; o componente cliente abre o grupo da rota atual, destaca o subitem
ativo, permite expansão independente e usa `aria-expanded` e `aria-controls`.
Em telas menores, a navegação mantém uma coluna para preservar a leitura dos
grupos.

Implantação validada em 27/08/2026: oito migrations sem pendências, builds
local/remoto aprovados, serviço ativo desde 09:28 -03 e health check com
aplicação e banco `ok`. O artefato publicado contém os três grupos e os
controles dos submenus. A mudança não altera schema nem dados e não exigiu
backup específico.

Em 27/08/2026, “Novo tipo de lançamento” e “Tipos cadastrados” foram removidos
do Centro de custos e transferidos para a rota exclusiva
`/tipos-lancamento`. O submenu Contabilidade passou a apresentar Plano de
contas, Tipos de lançamento, Centro de custos e Fechamentos nessa ordem. As
ações, permissões, validações e dados de `EntryType` foram preservados; somente
a organização das telas e consultas foi alterada.

Implantação validada em 27/08/2026: oito migrations sem pendências, builds
local/remoto aprovados, 19 rotas geradas, serviço ativo desde 09:40 -03 e health
check com aplicação e banco `ok`. O artefato contém a nova página e seu subitem
de menu. Nenhum dado foi alterado e não foi necessário backup específico.

Em 27/08/2026, o campo Histórico do Centro de custos deixou de ser obrigatório
em novos lançamentos e alterações. Quando não informado, o banco preserva sua
coluna obrigatória armazenando texto vazio. Históricos automáticos de compras de
combustível não foram alterados.

Implantação validada em 27/08/2026: builds local/remoto aprovados, 19 rotas
geradas, serviço ativo desde 09:48 -03 e health check com aplicação e banco
`ok`. O artefato publicado identifica Histórico como opcional. Não houve
alteração de schema nem de dados durante o deploy.

Em 27/08/2026, Usuários e acessos, Obras e Equipamentos receberam o mesmo fluxo
de seleção e alteração já usado em Pessoas, além de listagens com 20 registros
por página. Usuários podem atualizar dados, perfil, pessoa vinculada e
opcionalmente a senha; obras preservam código e competências; equipamentos
permitem alterar todos os campos cadastrais.

Implantação validada em 27/08/2026: typecheck e builds local/remoto aprovados,
oito migrations sem pendências, 19 rotas geradas, serviço ativo desde 10:56 -03
e health check com aplicação e banco `ok`. O domínio público respondeu HTTP 307
para `/login` com os cabeçalhos de segurança e o timer de backup permaneceu
ativo. Não houve alteração de schema ou escrita automática de dados, portanto
não foi necessário backup específico.

Em 27/08/2026, clientes de obras e fornecedores de combustível foram unificados
no novo cadastro `/empresas`, incluído no submenu Cadastros. Obras agora
selecionam uma empresa por chave estrangeira ou usam a opção “Obra própria”;
Combustível lista como fornecedores as empresas marcadas para essa finalidade.
A migration `20260827141000_unify_companies` preservou fornecedores, compras e
clientes já registrados e criou a permissão `companies.manage`.

Implantação validada em 27/08/2026: backup pré-migration
`terracusto-20260827-112049.dump`, 9 migrations aplicadas sem pendências, build
remoto aprovado com 20 rotas, serviço ativo desde 11:24 -03 e health check com
aplicação e banco `ok`. A conferência agregada encontrou 1 empresa, nenhuma obra
sem vínculo empresarial e nenhuma compra de combustível perdida. O domínio
público respondeu HTTP 307 para `/login` e o timer de backup permaneceu ativo.

## Código

- Repositório local: `/home/diogenes/Desenvolvimento/Reflex/terracusto`
- Branch consolidada: `feat/evolucoes-operacionais`
- Commit inicial de referência: `66a7b027cc46bf8a1d9b0b9949e6177b37582f58`
- Remoto esperado: `origin/feat/evolucoes-operacionais`; confirme o hash atual
  com `git rev-parse HEAD` antes da próxima implantação
- Árvore de trabalho esperada após a consolidação: limpa
- Migration inicial: `prisma/migrations/20260826173814_init/migration.sql`

### Cadastro estruturado de funções

Em 26/08/2026 foi implantada a evolução do cadastro de funções. A migration
`prisma/migrations/20260826181500_add_job_functions/migration.sql` preservou os
textos antigos, criou o catálogo `JobFunction` e passou `Person` a referenciá-lo.
A interface agora permite cadastrar funções e selecioná-las ao criar pessoas.
Também permite listar 20 pessoas por página e carregar uma pessoa da listagem no
formulário para alteração.

Na seleção, a linha recebe destaque visual, o título muda para “Alteração de
cadastro” e a ação principal muda para “Salvar cadastro”. A seleção também pode
ser feita por teclado e há uma ação para cancelar a alteração. Depois de salvar
uma alteração com sucesso, a seleção é limpa e o formulário retorna ao modo
“Novo cadastro”.

O código da obra passou a ser um número autoincrementável gerado pelo banco. A
migration `20260826193000_autoincrement_work_code` converte ambientes com obras
anteriores para uma sequência ordenada pela data de criação. Na produção não
havia obras no momento da conferência pré-migração.

Implantação validada em 26/08/2026: backup pré-migração
`terracusto-20260826-170403.dump` (59.554 bytes), migration aplicada, build
aprovado e serviço reiniciado. Uma pasta de migration vazia gerada durante a
renomeação foi detectada pelo Prisma antes de qualquer alteração no banco e
removida; somente a migration final `20260826193000_autoincrement_work_code`
compõe o histórico válido.

O tipo de equipamento também passou de uma lista fixa no código para o catálogo
`EquipmentType`. A migration `20260826203000_add_equipment_types` preserva o
tipo de todos os ativos existentes e cria os tipos iniciais Máquina, Veículo,
Ferramenta e Outro.

Implantação validada em 26/08/2026: backup pré-migração
`terracusto-20260826-172757.dump` (60.850 bytes), migration e seed aplicados,
build aprovado, serviço ativo e health check com banco `ok`. A conferência final
encontrou sete tipos ativos: os quatro iniciais e três tipos operacionais já
cadastrados; não havia duplicidades.

Na tela de lançamentos, os rótulos dos campos contábeis foram ajustados para
“Conta devedora” e “Conta credora”, preservando internamente as linhas de débito
e crédito já existentes.

O módulo da rota `/lancamentos` é apresentado como “Centro de custos” no título
da página e no menu lateral. A rota e a estrutura contábil permanecem iguais.

A tela de combustível passou a oferecer CRUD dos tipos de combustível, incluindo
preço de referência, edição, ativação/inativação e exclusão segura. A migration
`20260826213000_add_fuel_type_active` adiciona o controle de situação sem alterar
os registros existentes.

Implantação validada em 26/08/2026: backup pré-migração
`terracusto-20260826-181554.dump` (63.167 bytes), cinco migrations aplicadas,
build aprovado, serviço ativo, health check com banco `ok` e componente do CRUD
presente no artefato publicado.

O Centro de custos passou a trabalhar com competência operacional por obra. A
obra padrão é persistida no navegador, a data fica limitada ao mês vigente e ao
dia atual, e competências vencidas bloqueiam lançamentos até o fechamento. O
fechamento da última pendência abre o mês vigente. A migration
`20260826223000_backfill_accounting_periods` cria períodos abertos para
competências de lançamentos legados que ainda não possuíam controle explícito.

Implantação validada em 26/08/2026: backup pré-migração
`terracusto-20260826-184021.dump` (63.316 bytes), seis migrations aplicadas,
build aprovado, serviço ativo e health check com banco `ok`. A conversão não
encontrou lançamentos legados sem período: ao final havia zero competências
abertas e zero vencidas; novas obras passam a criar a competência vigente no
próprio cadastro.

O Centro de custos também possui cadastro flexível de tipos de lançamento. Cada
tipo define contas padrão sem impedir ajustes manuais. A migration
`20260826233000_add_entry_types` transforma `3.1` em Serviços sintética, cria
Serviços de máquinas, Despesas reembolsáveis, Reembolso de alimentação e
Alimentação, migra eventuais linhas antigas de `3.1` para `3.1.1` e cria os três
tipos iniciais.

Implantação validada em 26/08/2026: backup pré-migração
`terracusto-20260826-200722.dump` (63.603 bytes), sete migrations aplicadas,
cinco contas novas/reestruturadas conferidas, três tipos ativos, build aprovado,
serviço ativo e health check com banco `ok`.

O cadastro de uma nova conta analítica passou a invalidar também as telas de
Centro de custos e Combustível. Isso garante que contas recém-criadas apareçam
imediatamente nos seletores de contas padrão e nos lançamentos.

Contas analíticas criadas diretamente sob Serviços ou Despesas reembolsáveis
também passam a gerar automaticamente o respectivo tipo de lançamento. A
migration `20260827001000_sync_service_entry_types` cria os vínculos faltantes
para contas já existentes, incluindo `3.1.2 — Terraplenagem com trator`.

Implantação validada em 26/08/2026: backup
`terracusto-20260826-205133.dump` (68.520 bytes), oito migrations aplicadas e o
tipo “Terraplenagem com trator” confirmado como ativo, com devedora `1.2` e
credora `3.1.2`. Build, serviço e health check aprovados.

O fluxo de lançamentos em grupo do Centro de custos preserva os campos do grupo
após cada gravação e limpa apenas valor cobrado, hora de início e hora final.
Os horários passaram a ser informados como hora, sem campos adicionais de data.
A tela também lista até 20 lançamentos por página, filtrados pela obra
selecionada, e permite carregar uma linha no formulário para alteração. A
alteração valida as competências original e de destino, atualiza as partidas
balanceadas e retorna o formulário ao modo de novo lançamento.

Implantação validada em 26/08/2026: backup
`terracusto-20260826-212050.dump` (69.271 bytes), oito migrations sem
pendências, typecheck e builds local/remoto aprovados, serviço ativo desde
21:30 -03 e health check com aplicação e banco `ok`. O artefato publicado foi
conferido para os novos horários e para a listagem por obra. O domínio público
continuou respondendo HTTP 307 para `/login`, conforme esperado sem sessão.

As evoluções posteriores a `66a7b02` foram consolidadas na branch
`feat/evolucoes-operacionais`, permitindo que o conteúdo implantado volte a ser
rastreado pelo histórico do Git.

## Produção

| Item | Valor confirmado |
| --- | --- |
| URL pública | `https://terracusto.provizi.net.br` |
| Servidor | `provizi.net.br` / VPS `191.252.178.248` |
| Diretório | `/var/www/terracusto` |
| Usuário do processo | `terracusto` |
| Serviço | `terracusto.service` |
| Porta interna | `3120` |
| Ambiente | `/etc/terracusto.env` |
| Credenciais iniciais | `/root/terracusto-credentials.txt` |
| Banco | PostgreSQL, base `terracusto` |
| Proxy | Nginx |
| Certificado | Let's Encrypt ECDSA |
| Expiração observada | 24/11/2026 às 16:44:13 UTC |
| Backup | `/var/backups/terracusto` |
| Timer | `terracusto-backup.timer`, diariamente às 02:30 + atraso aleatório de até 15 min |
| Retenção | 14 dias completos; arquivos com mais de 14 dias são removidos |

Os arquivos de ambiente e credenciais existem na VPS, mas seus conteúdos não
foram copiados para esta documentação.

## Evidências da validação

- `terracusto.service`: `active (running)` e habilitado para reinício automático.
- `GET http://127.0.0.1:3120/api/health`: HTTP 200, aplicação `ok` e banco `ok`.
- `HEAD https://terracusto.provizi.net.br/`: HTTP/2 307 para `/login`.
- Cabeçalhos de segurança presentes no domínio público.
- `terracusto-backup.timer`: `enabled` e `active`; próxima execução observada em
  27/08/2026 às 02:32:28 -03.
- `nginx -t`: sintaxe e configuração válidas.
- Certificado específico de `terracusto.provizi.net.br`: válido.

### Validação da evolução de funções

- Backup pré-migração: `terracusto-20260826-151841.dump`, 56.636 bytes.
- `20260826181500_add_job_functions`: aplicada com sucesso.
- Seed: concluído, incluindo as cinco funções iniciais.
- Build de produção: aprovado, incluindo a rota dinâmica `/pessoas`.
- `terracusto.service`: reiniciado e ativo.
- Health check interno: aplicação `ok` e banco `ok`.
- Domínio público: HTTP 307 para `/login`, conforme esperado sem sessão.
- Evolução de paginação/edição: typecheck e build aprovados; componente
  `people-manager` sincronizado, serviço ativo e health check aprovado após o
  deploy de 26/08/2026 às 15:45 -03.
- Smoke test: login não executado porque a senha atual do administrador difere
  de `ADMIN_PASSWORD`. Isso indica troca da senha inicial; ela foi preservada e
  não foi redefinida. As demais verificações foram executadas separadamente.

O teste do Nginx mostrou avisos de `protocol options redefined` em configurações
de outros hosts (`movapi.provizi.net.br` e `provizi`). Eles não impediram o teste
nem o funcionamento do TerraCusto, mas devem ser tratados ao revisar a
configuração global do Nginx.

## Base para a próxima alteração

Antes de começar:

1. Confirme `git status --short` e a branch ativa.
2. Compare o commit em produção com o commit que será implantado.
3. Leia os limites conhecidos em `docs/ARQUITETURA.md`.
4. Se houver mudança de schema, crie e revise uma migration e faça backup antes
   de aplicá-la.
5. Execute `npm run typecheck`, `npm run build` e o smoke test.
6. Depois do deploy, atualize este documento com data, branch, commit, migration
   e resultados de validação.

Este arquivo é um retrato, não uma fonte dinâmica. Sempre confirme o estado real
da VPS antes de uma intervenção.
