# 24 — Dashboard e histórico usando `ocorridoEm`, `origem` e exclusão de estornos

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `Venda.ocorridoEm`, `Venda.origem`)
- **Origem:** Suporte ao fechamento manual retroativo e estornos da Fase 2 nos relatórios
- **Arquivos:** `backend/src/modules/dashboard/`, `backend/src/modules/vendas/`, `docs/api.md`
- **Branch sugerida:** `feat/backend-relatorios-ocorrido-em`

## Contexto
Com o fechamento manual (`origem: 'MANUAL'`) podendo registrar vendas retroativas (ex.: fechamento de ontem lançado hoje via `ocorridoEm` ao meio-dia em MS) e também estornar lançamentos incorretos (`payloadOriginal._estorno`), os relatórios e listagens precisam refletir a data real do evento, identificar a origem e descontar estornos. Os índices `[ocorridoEm]` e `[origem, ocorridoEm]` já existem na tabela `vendas`.

## Problema
Relatórios e históricos baseados apenas em `criadoEm` atribuem vendas retroativas ao dia errado, não distinguem lançamentos manuais de webhooks da Anota AI e contariam vendas estornadas nos totais e no consumo de insumos.

## Comportamento esperado
- **Data do evento (`ocorridoEm`):** queries de vendas processadas no `GET /api/dashboard/resumo`, relatórios e listagens de histórico passam a filtrar e agrupar por `ocorridoEm` em vez de `criadoEm` (no fuso `America/Campo_Grande`).
- **Marcação de `MANUAL`:** vendas com `origem = 'MANUAL'` aparecem marcadas explicitamente com `origem` (e sinalização correspondente) nos históricos/resumos retornados pela API.
- **Vendas estornadas fora dos totais:** vendas manuais estornadas (`payloadOriginal._estorno` presente) ficam **fora** dos totais de vendas, faturamento/séries e cálculo de consumo de insumos nos relatórios e no dashboard. Documentar essa regra explicitamente em `docs/api.md`.
- Manter `POST /api/vendas/consolidar`, `GET /api/vendas/retidas` e `POST /api/vendas/marcar-tratadas` operando apenas sobre vendas `origem: 'WEBHOOK'` pendentes (`processado: false`), sem misturar lançamentos `MANUAL`.
- Atualizar `docs/api.md` documentando `ocorridoEm`, marcação de `origem` e a exclusão de vendas estornadas nos relatórios.

## Teste que deve falhar antes
- Uma `Venda` com `origem: 'MANUAL'`, `processado: true`, `criadoEm = hoje`, mas `ocorridoEm = há 3 dias` aparece nos relatórios do dia `há 3 dias`, marcada como `MANUAL`, e **não** entra na contagem/série de hoje.
- Uma `Venda` `MANUAL` estornada (com `_estorno` no payload) fica fora dos totais de vendas e fora do consumo estimado no dashboard/relatórios.
- Uma `Venda` `MANUAL` nunca entra em `consolidar`, `/api/vendas/retidas` ou `marcar-tratadas`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado com a regra de filtragem por `ocorridoEm`, marcação `MANUAL` e exclusão de estornadas; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma` ou criar novos gráficos no frontend.
