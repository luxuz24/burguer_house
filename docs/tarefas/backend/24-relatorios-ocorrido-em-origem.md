# 24 — Dashboard e histórico usando `ocorridoEm`, `origem` e exclusão de estornos

- **Tipo:** feat · **Fase:** 3 · **Estado:** PENDENTE (schema pronto na Fase 2 — `Venda.ocorridoEm`, `Venda.origem`)
- **Depende de:** [22](22-fechamento-manual-dia.md) e [25](25-fechamento-manual-estorno.md) (precisa dos dados `MANUAL` e do `_estorno`)
- **Consumida por (frontend):** [17](../frontend/17-relatorios-vendas-manuais.md)
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

## Contrato de resposta
`GET /api/dashboard/resumo` ganha dois campos em `kpis` (subconjunto já incluído em `totalVendasQtd`/`totalVendasValor`; **não** somar de novo):
```json
"kpis": { "totalVendasValor": 12450.0, "totalVendasQtd": 312,
          "vendasManuaisQtd": 18, "vendasManuaisValor": 940.0, "…": "…" }
```
- `itensMaisVendidos` e `consumoInsumos` incluem os fechamentos manuais (não estornados) e excluem os estornados.
- Pedidos de webhook cancelados continuam fora, como hoje.
- Período personalizado e fuso `America/Campo_Grande` seguem as regras atuais, agora sobre `ocorridoEm`.
- Sem fechamentos manuais, `vendasManuaisQtd` e `vendasManuaisValor` são `0` (nunca ausentes).

## Teste que deve falhar antes
- Uma `Venda` com `origem: 'MANUAL'`, `processado: true`, `criadoEm = hoje`, mas `ocorridoEm = há 3 dias` aparece nos relatórios do dia `há 3 dias`, marcada como `MANUAL`, e **não** entra na contagem/série de hoje.
- Uma `Venda` `MANUAL` estornada (com `_estorno` no payload) fica fora dos totais de vendas e fora do consumo estimado no dashboard/relatórios.
- Uma `Venda` `MANUAL` nunca entra em `consolidar`, `/api/vendas/retidas` ou `marcar-tratadas`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado com a regra de filtragem por `ocorridoEm`, marcação `MANUAL` e exclusão de estornadas; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README e arquivo movido para `realizadas/`.

## Fora do escopo
Alterar `schema.prisma` ou criar novos gráficos no frontend.
