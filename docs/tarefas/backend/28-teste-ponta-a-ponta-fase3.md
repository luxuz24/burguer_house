# 28 — Teste de ponta a ponta da Fase 3 (um dia completo)

- **Tipo:** test · **Fase:** 3 · **Estado:** PENDENTE (rodar por último)
- **Origem:** Cada tarefa da Fase 3 é testada isolada. O que mais quebra em estoque é a **combinação** (entrada + fechamento + estorno + relatório) e a concorrência entre elas.
- **Depende de:** [21](21-insumos-categoria.md), [22](22-fechamento-manual-dia.md), [23](23-entrada-manual-estoque.md), [24](24-relatorios-ocorrido-em-origem.md), [25](25-fechamento-manual-estorno.md), [26](26-fechamento-manual-listagem.md)
- **Arquivos:** `backend/tests/` (novo `fase3_dia_completo.spec.ts`), `docs/api.md` (só ajustes de coerência)
- **Branch sugerida:** `test/backend-fase3-dia-completo`

## Contexto
Os testes unitários e HTTP de cada rota passam isolados. Falta provar que o conjunto fecha as contas: o saldo final de cada insumo bate com a soma de todas as operações, e os relatórios contam só o que deve.

## Problema
Sem um teste de cenário, regressões de integração (ex.: estorno devolvendo valor diferente do baixado, relatório contando venda estornada, categoria sumindo do alerta) só aparecem em produção.

## Comportamento esperado (cenário testado)
Banco `_test` com o seed (`categoria` preenchida, produtos de bebida), usuário autenticado:
1. **Entrada manual** em lote: `+24` Coca Cola Zero 350ml, `+500` Saco Kraft (embalagem), `+2000` g de Carne com custo.
2. **Simulação** do fechamento de `3 BACON HOUSE` + `6 Coca Cola Zero 350ml`: anota o `estoqueProjetado` de cada insumo.
3. **Confirmação** do fechamento: os saldos reais batem com o projetado da simulação; `insumosComEstoqueNegativo` ausente.
4. **Replay** da mesma chave: nada muda; `reaproveitado: true`.
5. **Segundo fechamento** (outra chave) deixando um insumo negativo: `insumosComEstoqueNegativo` preenchido e o alerta de estoque mínimo do dashboard lista o insumo.
6. **Alteração da ficha** do BACON HOUSE; depois **estorno** do primeiro fechamento: os saldos voltam exatamente ao que o snapshot baixou (não ao consumo da ficha nova).
7. **Listagem do dia**: dois fechamentos, o primeiro marcado `estornada`.
8. **Dashboard** do dia: o fechamento estornado fica fora de vendas e do consumo; o outro entra com `origem` manual; um fechamento com `ocorridoEm` de 3 dias atrás aparece só no período certo.
9. **Consolidação automática** (`POST /api/vendas/consolidar`) roda no meio e não altera nada das vendas manuais.
10. **Conservação**: para cada insumo, `estoque final = estoque inicial + entradas − consumo dos fechamentos não estornados` (calculado no teste, independente do código de produção).
11. **Concorrência**: dois fechamentos e uma entrada manual simultâneos no mesmo insumo terminam com saldo exato.

## Teste que deve falhar antes
O próprio cenário. Para provar que ele pega regressão, aplicar **mutações manuais** e ver o teste falhar (reverter com `git checkout -- <arquivo>` em seguida), registrando no PR: (a) estorno recalculando pela ficha atual; (b) relatório sem o filtro de estornadas; (c) simulação divergindo da baixa real; (d) replay baixando de novo.

## Critério de pronto
- [ ] Cenário completo verde no banco `_test`; as 4 mutações acima fazem o teste falhar (saída no PR).
- [ ] Mutação (Stryker) das tarefas 21–26 conferida: nenhum serviço de escrita abaixo de 85%.
- [ ] Linha marcada `FEITA (#PR)` e arquivo movido para `realizadas/`.

## Fora do escopo
Testes de interface (tarefas 18 e 19 do frontend), carga/desempenho.
