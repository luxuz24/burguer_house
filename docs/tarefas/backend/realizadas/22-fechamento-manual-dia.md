# 22 — Fechamento manual do dia: simulação e confirmação (núcleo)

- **Tipo:** feat · **Fase:** 3 · **Estado:** FEITA (#101) (schema pronto na Fase 2 — `OrigemVenda`, `registradoPorId`, `ocorridoEm`)
- **Origem:** Pedido da hamburgueria (baixa de estoque pelos pedidos vendidos enquanto não há integração com a Anota AI)
- **Depende de:** Fase 2 (PR #97). Vem antes de [25](25-fechamento-manual-estorno.md) e [26](26-fechamento-manual-listagem.md).
- **Consumida por (frontend):** [12](../frontend/12-fechamento-dia-tela-e-simulacao.md) e [13](../frontend/13-fechamento-dia-confirmacao-e-estorno.md)
- **Arquivos:** `backend/src/modules/vendas/` (novo serviço de fechamento), `backend/src/modules/vendas/services/planejar_consolidacao.ts` (reaproveitar), `backend/src/infra/http/controllers/`, `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md`, `docs/requests.md`
- **Branch sugerida:** `feat/backend-fechamento-manual-nucleo`

## Contexto
Enquanto a integração com a Anota AI não está ativa, o operador lança ao fim do dia o que saiu (lanches e bebidas) e o estoque baixa pelas fichas técnicas já cadastradas. A tabela `vendas` já tem `origem` (`WEBHOOK` | `MANUAL`), `registradoPorId` (usuário do JWT) e `ocorridoEm` (quando a venda realmente aconteceu). O consumo continua pela ficha técnica: embalagens e bebidas já são insumos nas fichas (o seed traz um produto de 1 unidade para cada bebida).

## Problema
Não existe rota para conferir o impacto antes de baixar nem para registrar a baixa de forma atômica e idempotente. Sem isso, o operador não vê o que vai acontecer com o estoque, e um reenvio ou duplo toque baixa tudo duas vezes.

## Comportamento esperado
Ambas as rotas exigem JWT (`401` sem token válido).

### 1. `POST /api/vendas/fechamento-manual/simulacao` (somente leitura)
Body (Zod): `{ data?: "AAAA-MM-DD", itens: [{ produtoId: uuid, quantidade: int 1..500 }] }`, `1..100` itens; mesmo `produtoId` repetido soma as quantidades.
- NÃO grava nada (nem `Venda`, nem saldo).
- Reaproveita a expansão de fichas e o `fatorPerdaSeguro` da consolidação (não duplicar o cálculo).
- Resposta `200`:
```json
{
  "data": "2026-11-13",
  "itens": [{ "produtoId": "uuid", "nome": "BACON HOUSE", "quantidade": 2 }],
  "consumos": [
    {
      "insumoId": "uuid", "nome": "Carne de Hambúrguer", "unidade": "Gramas", "categoria": "INGREDIENTE",
      "consumo": 320, "estoqueAtual": 1400, "estoqueProjetado": 1080, "ficariaNegativo": false
    }
  ],
  "produtosSemFicha": [{ "produtoId": "uuid", "nome": "X-Tudo" }],
  "temNegativo": false,
  "podeConfirmar": true
}
```
- `podeConfirmar = false` quando houver `produtosSemFicha`. `produtoId` inexistente → `422`.
- Ordem de `consumos`: primeiro os que ficariam negativos, depois por `categoria` e `nome`.

### 2. `POST /api/vendas/fechamento-manual` (grava)
Body (Zod):
- `chaveIdempotencia`: **obrigatória**, `string` 8..100 (`trim`). O frontend gera um UUID por tentativa de confirmação.
- `data`: opcional, `"AAAA-MM-DD"` (padrão: hoje no fuso `America/Campo_Grande`, via `parsearDiaLoja`); rejeita futura e data inexistente com `400`.
- `itens`: `1..100` itens `{ produtoId: uuid, quantidade: int 1..500 }` (repetido soma).
- `observacao`: opcional, até 500.

Em **uma única transação**:
- cria **uma** `Venda`: `origem = 'MANUAL'`, `registradoPorId` do JWT, `processado = true`, `externalId = "manual:" + chaveIdempotencia`, `ocorridoEm` = **meio-dia (12:00) da `data` no fuso da loja** (evita ambiguidade de fronteira);
- grava `payloadOriginal` no formato oficial (o adaptador e a listagem leem isto):
```json
{
  "info": { "id": "<externalId>", "check": 1, "items": [{ "name": "<Produto.nome>", "quantity": 2 }] },
  "origem": "manual",
  "data": "AAAA-MM-DD",
  "observacao": "...",
  "_fechamento": { "consumos": [{ "insumoId": "...", "quantidade": 320 }] }
}
```
- reaproveita `planejarConsolidacao`/a baixa existente **dentro da mesma transação**; `_fechamento.consumos` guarda o consumo exato baixado por insumo (é o que o estorno devolve — tarefa 25).

Respostas:
- Primeira vez → `201`:
```json
{
  "reaproveitado": false,
  "vendaId": "uuid", "externalId": "manual:...", "chaveIdempotencia": "...",
  "data": "2026-11-13", "ocorridoEm": "2026-11-13T16:00:00.000Z",
  "itens": [{ "produtoId": "uuid", "nome": "BACON HOUSE", "quantidade": 2 }],
  "consumos": [{ "insumoId": "uuid", "nome": "...", "unidade": "Gramas", "quantidade": 320 }],
  "insumosComEstoqueNegativo": [{ "id": "uuid", "nome": "...", "estoqueAtual": -20 }]
}
```
- Mesma chave + mesmo corpo → `200` com o resultado anterior e `reaproveitado: true`, sem baixar de novo.
- Mesma chave + corpo diferente → `409` (`{ "message": "..." }`).
- Produto inexistente ou sem ficha → `422` para o pedido **inteiro**, sem baixar nada nem criar `Venda`:
  `{ "message": "...", "produtosNaoEncontrados": ["uuid"], "produtosSemFicha": [{ "produtoId": "uuid", "nome": "X-Tudo" }] }`.
- Estoque pode ficar negativo (a venda já aconteceu); sinalizar em `insumosComEstoqueNegativo`.
- Duas requisições simultâneas com a mesma chave: só uma baixa; a outra trata a violação de unicidade de `externalId` (`P2002`) como replay (compara o corpo: `200` `reaproveitado: true`, ou `409` se divergir).

### Regras transversais
- Vendas `MANUAL` nascem `processado = true`: `POST /api/vendas/consolidar` e `POST /api/vendas/marcar-tratadas` **não** as tocam.
- Aviso operacional em `docs/api.md`: não lançar fechamento manual para um dia já coberto pela integração real via webhook (baixa duplicada). A decisão de convivência está em [27](27-convivencia-manual-webhook.md) (BLOQUEADA, decisão do dono).
- Custo: nada a recalcular; o fechamento só consome estoque.

## Teste que deve falhar antes
- Sem JWT → `401` nas duas rotas.
- `400`: itens vazios, `quantidade` `<= 0` ou `> 500`, mais de 100 itens, `data` futura, `chaveIdempotencia` ausente ou com menos de 8 caracteres.
- Simulação: devolve `consumos` com `fatorPerdaSeguro` e `ficariaNegativo`; contagem de `vendas` e saldos de `insumos` idênticos antes e depois; `podeConfirmar: false` com produto sem ficha; `422` com `produtoId` inexistente.
- `2 BACON HOUSE` + `1 Coca Cola Zero 350ml`: grava a `Venda` (`MANUAL`, `processado: true`, `registradoPorId`, `ocorridoEm` ao meio-dia em MS, `_fechamento.consumos`) e baixa ingredientes, embalagens e a bebida 1:1.
- Replay idempotente (`200`, `reaproveitado: true`, sem baixar de novo); mesma chave com corpo diferente → `409`.
- Produto inexistente no meio da lista → `422` e nenhum insumo alterado, nenhuma `Venda` criada.
- Concorrência real (`Promise.all`): chaves diferentes no mesmo insumo → saldo final exato; mesma chave → baixa uma única vez.
- `consolidar` e `marcar-tratadas` ignoram vendas `MANUAL`.

## Critério de pronto
- [x] RED/GREEN no banco `_test`; mutação `>= 85%` no serviço de escrita (cada sobrevivente justificado um a um, nunca por grupo).
- [x] Reaproveitamento de `planejarConsolidacao` verificado (sem cálculo duplicado).
- [x] `docs/api.md` atualizado no mesmo commit (formatos acima + aviso de baixa dupla); linha da tabela marcada `FEITA (#101)` e arquivo movido para `realizadas/`.

## Fora do escopo
Estorno ([25](25-fechamento-manual-estorno.md)), listagem ([26](26-fechamento-manual-listagem.md)), alterar `schema.prisma`, tela do frontend.
