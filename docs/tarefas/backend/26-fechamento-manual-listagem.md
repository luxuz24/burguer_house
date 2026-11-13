# 26 — Fechamento manual: listagem do dia

- **Tipo:** feat · **Fase:** 3 · **Estado:** PENDENTE
- **Origem:** O operador precisa ver o que já lançou no dia (e desfazer, se errou)
- **Depende de:** [22](22-fechamento-manual-dia.md) (formato do `payloadOriginal`); a flag `estornada` vem da [25](25-fechamento-manual-estorno.md)
- **Consumida por (frontend):** [14](../frontend/14-fechamento-dia-lista-do-dia.md)
- **Arquivos:** `backend/src/modules/vendas/` (consulta/serviço), `backend/src/infra/http/controllers/`, `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md`
- **Branch sugerida:** `feat/backend-fechamentos-manuais-listagem`

## Contexto
Cada fechamento é uma `Venda` `MANUAL`; os itens e a observação ficam em `payloadOriginal` (`info.items`, `observacao`), o autor em `registradoPorId` e o estorno em `payloadOriginal._estorno`.

## Problema
Não há como listar os fechamentos de um dia. Sem isso, o operador não sabe se já lançou o dia e não encontra o lançamento que precisa estornar.

## Comportamento esperado
`GET /api/vendas/fechamentos-manuais?data=AAAA-MM-DD` (JWT; `401` sem token).
- `data` opcional (padrão: hoje no fuso `America/Campo_Grande`); formato inválido → `400`. Data futura é permitida para consulta (devolve lista vazia).
- Filtra `origem = 'MANUAL'` com `ocorridoEm` dentro do dia da loja (`obterIntervaloDiaLoja`).
- Ordenação: mais novos primeiro (`criadoEm` desc).
- Resposta `200`:
```json
{
  "data": "2026-11-13",
  "total": 2,
  "fechamentos": [
    {
      "id": "uuid", "externalId": "manual:abc12345", "criadoEm": "2026-11-13T22:41:00.000Z",
      "ocorridoEm": "2026-11-13T16:00:00.000Z", "observacao": "Sábado cheio",
      "itens": [{ "nome": "BACON HOUSE", "quantidade": 2 }],
      "usuario": { "id": "uuid", "nome": "Carlos Eduardo" },
      "estornada": false,
      "estorno": null
    },
    {
      "id": "uuid", "externalId": "manual:def67890", "criadoEm": "2026-11-13T21:10:00.000Z",
      "ocorridoEm": "2026-11-13T16:00:00.000Z", "observacao": null,
      "itens": [{ "nome": "Coca Cola Zero 350ml", "quantidade": 6 }],
      "usuario": { "id": "uuid", "nome": "Bruna" },
      "estornada": true,
      "estorno": { "em": "2026-11-13T21:30:00.000Z", "motivo": "Lancei errado", "usuario": { "id": "uuid", "nome": "Carlos Eduardo" } }
    }
  ]
}
```
- `usuario` é `null` se o usuário foi apagado (FK `SetNull`).
- Sem N+1: uma consulta para as vendas e uma para os nomes dos usuários.
- Não expõe `_fechamento.consumos` (detalhe interno).

## Teste que deve falhar antes
- `401` sem JWT; `400` com `data` inválida.
- Dois fechamentos no dia (um estornado): lista os dois, mais novo primeiro, com `usuario.nome`, `itens`, `observacao` e `estornada`.
- Fechamento com `ocorridoEm` de outro dia **não** aparece; venda `WEBHOOK` do mesmo dia **não** aparece.
- Fechamento de "ontem" lançado hoje aparece na lista de ontem e não na de hoje.
- Usuário apagado → `usuario: null`, sem erro.
- Número de consultas independe da quantidade de fechamentos (sem N+1).

## Critério de pronto
- [ ] RED/GREEN no banco `_test`.
- [ ] `docs/api.md` atualizado no mesmo commit; linha marcada `FEITA (#PR)` e arquivo movido para `realizadas/`.

## Fora do escopo
Paginação (volume baixo: poucos fechamentos por dia), edição de fechamento (o caminho é estornar e lançar de novo), tela do frontend.
