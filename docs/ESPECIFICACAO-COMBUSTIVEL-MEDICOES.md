# Especificação técnica — abastecimentos, fornecedores e medições

## Objetivo

Controlar abastecimentos provenientes de tanque interno ou diretamente de posto,
mantendo em uma única sequência o consumo de cada equipamento, a obrigação com
fornecedores, o custo por obra e o reembolso mensal de combustível ao cliente.

## Princípios

- Todo abastecimento completa o tanque do equipamento.
- A origem física é `INTERNAL_TANK` ou `DIRECT_SUPPLIER`.
- A origem não interrompe a sequência de odômetro/horímetro do equipamento.
- O custo é congelado no abastecimento: preço da nota no posto e custo médio na
  saída do tanque interno.
- O abastecimento cria um item gerencial a medir. O contas a receber e a receita
  somente são reconhecidos no fechamento da medição mensal.
- Obras próprias podem receber custos, mas não geram reembolso.
- Operações integradas são atômicas e lançamentos automáticos não são editáveis
  pelo Centro de custos.

## Matriz contábil

| Evento | Débito | Crédito |
| --- | --- | --- |
| Compra a prazo para tanque interno | `1.3 Estoque de combustível` | `2.1 Fornecedores` |
| Compra à vista para tanque interno | `1.3 Estoque de combustível` | `1.1 Caixa e bancos` |
| Saída do tanque interno | `4.1 Combustíveis` | `1.3 Estoque de combustível` |
| Abastecimento direto a prazo | `4.1 Combustíveis` | `2.1 Fornecedores` |
| Abastecimento direto à vista | `4.1 Combustíveis` | `1.1 Caixa e bancos` |
| Fechamento da medição | `1.2 Clientes` | `3.2.2 Reembolso de combustíveis` |
| Pagamento ao fornecedor | `2.1 Fornecedores` | `1.1 Caixa e bancos` |

Compras para estoque e pagamentos de fornecedores são lançamentos financeiros
sem obra. O custo é apropriado à obra quando o equipamento é abastecido.

## Abastecimento direto

O registro contém fornecedor, documento, condição à vista/a prazo, vencimento
quando a prazo, combustível inferido pelo equipamento, litros, preço unitário,
valor total, equipamento, obra, operador, medidor e indicação de reembolso.
Uma nota corresponde a um equipamento. O abastecimento não movimenta tanque
interno. Em compra a prazo, cria também um título na conta corrente do
fornecedor.

## Abastecimento por tanque interno

A compra aumenta o saldo físico e financeiro do tanque. A saída usa o custo
médio móvel do reservatório, reduz seu saldo e apropria o custo à obra. O valor
elegível para medição é o custo efetivo congelado nessa saída.

## Consumo

- Veículo: diferença do odômetro dividida pelos litros do abastecimento atual.
- Máquina: litros do abastecimento atual divididos pela diferença do horímetro.
- A referência anterior é o último abastecimento completo do equipamento,
  independentemente da origem.
- Data e medidor devem avançar; exceções futuras devem usar correção auditada.

## Contas a pagar

Compras a prazo para tanque e abastecimentos diretos a prazo geram títulos com
fornecedor, documento, emissão, vencimento e valor. O usuário registra somente
fornecedor, data e valor do pagamento. O sistema distribui o valor por FIFO:

1. menor vencimento;
2. menor data de origem;
3. ordem de criação.

A alocação é persistida mesmo não sendo escolhida pelo usuário. Isso permite
identificar títulos abertos, parciais, pagos e vencidos. O pagamento não gera
novo custo nem exige obra.

## Medição mensal

Uma medição pertence a uma obra, cliente e competência. Ao ser criada ou
atualizada, incorpora os abastecimentos reembolsáveis, ainda não medidos, cuja
data pertença à competência. Estados:

- `DRAFT`: itens revisáveis e sem lançamento de receita;
- `CLOSED`: total congelado e lançamento `Clientes × Reembolso` criado;
- `CANCELED`: rascunho cancelado, com itens liberados.

O fechamento exige competência contábil aberta, ao menos um item e obra com
cliente. Depois do fechamento, os itens não podem integrar outra medição.

## Relatórios

### Fornecedores

- resumo de compras, pagamentos, saldo, vencido e a vencer por fornecedor;
- total consolidado de todas as empresas;
- detalhamento dos títulos de uma empresa, com documento, vencimento, origem,
  valor, valor pago, saldo e situação;
- posição filtrável por data e saída para impressão.

### Medições

- identificação de cliente, obra, competência e situação;
- abastecimentos com data, equipamento, origem, litros e custo real;
- total da medição e vínculo com o lançamento contábil.

## Integridade e auditoria

- Documento direto, abastecimento, título e lançamento são gravados na mesma
  transação.
- Pagamentos e alocações são gravados na mesma transação serializável.
- Fechamento da medição e lançamento contábil são atômicos.
- Lançamentos gerados por combustível, fornecedor ou medição não podem ser
  alterados manualmente.
- Criação, pagamento, atualização, fechamento e cancelamento são auditados.

## Migração

- Abastecimentos existentes permanecem como origem `INTERNAL_TANK`.
- Registros históricos não entram automaticamente em novas medições.
- O vínculo de obra deixa de ser obrigatório em compras de estoque e
  lançamentos exclusivamente financeiros.
- É criada a conta `3.2.2 Reembolso de combustíveis` e o respectivo tipo de
  lançamento, sem substituir cadastros existentes de mesmo código/nome.
