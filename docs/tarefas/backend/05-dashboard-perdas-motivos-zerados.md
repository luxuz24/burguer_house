# 05 — `perdasPorMotivo` sempre traz os 4 motivos, zerados quando não houve perda

- **Tipo:** fix (contrato) · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "Ajustes de `GET /api/dashboard/resumo` vistos no endurecimento F4", item 1 (11/11/2026)
- **Arquivos:** `backend/src/modules/dashboard/services/dashboard.service.ts` (~197-236),
  `dashboard.service.spec.ts`, `docs/api.md` (`GET /api/dashboard/resumo`)
- **Branch sugerida:** `fix/backend-dashboard-perdas-motivos`

## Problema
O serviço inicializa `VENCIMENTO`, `ERRO_PREPARO`, `ESTRAGADO` e `OUTRO` com zero e devolve os quatro.
O exemplo do contrato mostra só os motivos com perda. Até o F4 a tela nunca mostrava "Nenhuma perda no
período." e desenhava barra para motivo zerado; o front hoje filtra
`totalOcorrencias > 0 || valorTotal > 0` para se proteger.

## Decisão a tomar no PR (escolha uma e justifique)
- **A (recomendada):** o backend devolve só motivos com `totalOcorrencias > 0`; período sem perda →
  `perdasPorMotivo: []`. O contrato fica como já está escrito.
- **B:** manter os 4 sempre e documentar isso no `docs/api.md`.
A opção A não quebra o front (o filtro dele vira redundante, sem efeito).

## Teste que deve falhar antes (opção A)
- Período sem perdas → `perdasPorMotivo` vazio. Hoje vem com 4 itens zerados.
- Uma perda `ESTRAGADO` → só esse motivo na lista, com valores corretos (regressão).
- Ordem da lista documentada (ex.: por `valorTotal` desc) e testada.

## Critério de pronto
- [x] Teste falhando antes (saída no PR) e passando depois.
- [x] `docs/api.md` coerente com a opção escolhida.
- [x] Item 1 da entrada do `requests.md` marcado RESOLVIDO.

## Fora do escopo
Itens 2 e 3 da mesma entrada (tarefas 06 e 07).
