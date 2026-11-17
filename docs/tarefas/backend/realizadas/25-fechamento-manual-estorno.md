# 25 — Fechamento manual: estorno

- **Tipo:** feat · **Fase:** 3 · **Estado:** FEITA (#102)
- **Origem:** Segurança do fechamento manual: sem desfazer, um erro de digitação baixa estoque errado sem volta
- **Depende de:** [22](22-fechamento-manual-dia.md) (precisa do snapshot `_fechamento.consumos`)
- **Consumida por (frontend):** [13](../../frontend/realizadas/13-fechamento-dia-confirmacao-e-estorno.md)
- **Arquivos:** `backend/src/modules/vendas/` (serviço de estorno), `backend/src/infra/http/controllers/`, `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md`
- **Branch sugerida:** `feat/backend-fechamento-manual-estorno`

## Contexto
O fechamento manual grava, em `payloadOriginal._fechamento.consumos`, exatamente quanto de cada insumo foi baixado. As fichas técnicas podem mudar depois do fechamento; por isso o estorno **não recalcula**: ele devolve o snapshot.

## Problema
Um fechamento lançado com quantidade ou produto errado não tem como ser desfeito de forma segura. Estornar recalculando pela ficha atual devolveria quantidades diferentes das que saíram.

## Comportamento esperado
`POST /api/vendas/:id/estornar` (JWT; `401` sem token). `:id` deve ser uuid (`400` caso contrário).
- Body (Zod): `{ motivo: string 1..500 (trim) }`.
- Em **uma transação**, só para vendas `origem = 'MANUAL'` e ainda não estornadas:
  - devolve ao estoque **exatamente** `payloadOriginal._fechamento.consumos` (incremento atômico por insumo);
  - grava `_estorno: { usuarioId, em: <ISO>, motivo }` em `payloadOriginal`, mantendo `_fechamento` intacto;
  - não apaga a `Venda` (auditoria): `processado` continua `true`.
- Resposta `200`:
```json
{
  "vendaId": "uuid",
  "estornada": true,
  "estorno": { "usuarioId": "uuid", "em": "2026-11-13T19:02:11.000Z", "motivo": "Lancei o dia errado" },
  "devolucoes": [{ "insumoId": "uuid", "nome": "Carne de Hambúrguer", "unidade": "Gramas", "quantidade": 320, "estoqueAtual": 1400 }]
}
```
- Erros: venda inexistente → `404`; `origem = 'WEBHOOK'` → `400` ("Só é possível estornar fechamentos manuais"); já estornada → `409`; venda `MANUAL` sem `_fechamento.consumos` (dado legado) → `422` sem alterar nada.
- Concorrência: duas chamadas simultâneas ao mesmo estorno devolvem o estoque **uma única vez** (a segunda recebe `409`).
- Insumo que foi apagado depois do fechamento não é possível (FK `Restrict` em fichas/movimentações; se o insumo não existir mais, `422` sem alterar nada).
- Relatórios: vendas estornadas saem dos totais (regra da [24](24-relatorios-ocorrido-em-origem.md)).

## Teste que deve falhar antes
- `401` sem JWT; `400` para id inválido ou motivo vazio/maior que 500.
- Fechar `2 BACON HOUSE`, estornar → todos os saldos voltam **exatamente** aos valores de antes do fechamento.
- Alterar a ficha de `BACON HOUSE` depois do fechamento e estornar → devolve o snapshot, não o consumo da ficha nova.
- Segundo estorno → `409` e saldos intactos; estorno de venda `WEBHOOK` → `400`; venda inexistente → `404`; `MANUAL` sem snapshot → `422`.
- Duas chamadas simultâneas (`Promise.all`): saldo restaurado uma vez só.
- `_estorno` gravado com `usuarioId` do JWT, `motivo` e `em`.

## Critério de pronto
- [x] RED/GREEN no banco `_test`; mutação `>= 85%` no serviço (sobreviventes justificados um a um).
- [x] `docs/api.md` atualizado no mesmo commit; linha marcada `FEITA (#102)` e arquivo movido para `realizadas/`.

## Fora do escopo
Estornar vendas de webhook (cancelamento depois de consolidar é a tarefa [19](19-cancelamento-apos-consolidacao.md), BLOQUEADA), tela do frontend.
