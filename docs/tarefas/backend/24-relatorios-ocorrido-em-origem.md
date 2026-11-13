# 24 — Dashboard e histórico usando `Venda.ocorridoEm` e `origem`

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `Venda.ocorridoEm`, `Venda.origem`)
- **Origem:** Suporte ao fechamento manual retroativo da Fase 2 nos relatórios
- **Arquivos:** `backend/src/modules/dashboard/`, `backend/src/modules/vendas/`, `docs/api.md`
- **Branch sugerida:** `feat/backend-relatorios-ocorrido-em`

## Contexto
Com a chegada do fechamento manual (`origem: 'MANUAL'`) podendo registrar vendas retroativas (ex.: fechamento de ontem lançado hoje de manhã via `ocorridoEm`), os agregados de vendas no `GET /api/dashboard/resumo` e listagens/relatórios de vendas não devem depender apenas de `criadoEm`. Os índices `[ocorridoEm]` e `[origem, ocorridoEm]` já existem na tabela `vendas`.

## Comportamento esperado
- Queries de vendas processadas no período em `dashboard.service.ts` e listagens de histórico passam a filtrar e agrupar por `ocorridoEm` em vez de `criadoEm` (mantendo o fuso `America/Campo_Grande`).
- Manter `POST /api/vendas/consolidar` e `GET /api/vendas/retidas` tratando apenas vendas `origem: 'WEBHOOK'` pendentes (`processado: false`), sem misturar lançamentos `MANUAL`.
- Retornar `origem` e `ocorridoEm` quando aplicável nos resumos/listagens e documentar em `docs/api.md`.

## Teste que deve falhar antes
- Uma `Venda` com `origem: 'MANUAL'`, `processado: true`, `criadoEm = hoje`, mas `ocorridoEm = há 3 dias` aparece nos relatórios do dia `há 3 dias` e **não** infla a contagem/série de hoje.
- Uma `Venda` `MANUAL` nunca entra no `consolidar` nem em `/api/vendas/retidas`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado se algum campo de resposta mudar; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma` ou criar novos gráficos no frontend.
