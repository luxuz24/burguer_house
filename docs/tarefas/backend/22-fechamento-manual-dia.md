# 22 — Fechamento manual do dia: simulação, confirmação, estorno e listagem

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `OrigemVenda`, `registradoPorId`, `ocorridoEm`)
- **Origem:** Pedido da hamburgueria (baixa de estoque pelos pedidos vendidos antes da integração com a Anota AI)
- **Arquivos:** `backend/src/modules/vendas/`, `backend/src/infra/http/controllers/`,
  `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md`, `docs/requests.md`
- **Branch sugerida:** `feat/backend-fechamento-manual-dia`

## Contexto
Enquanto a integração automática com a Anota AI não está ativa em produção, o operador precisa lançar ao final do dia os produtos vendidos (lanches e bebidas) para baixar o estoque usando as fichas técnicas já cadastradas. A tabela `vendas` já possui `origem` (`WEBHOOK` | `MANUAL`), `registradoPorId` (`Usuario` do JWT) e `ocorridoEm`.

## Problema
Sem rotas dedicadas de simulação, confirmação atômica com snapshot de consumo, idempotência obrigatória, estorno e listagem diária, o operador não consegue conferir impactos no estoque antes de confirmar, fica vulnerável a baixas duplicadas em reenvios/duplo clique e não tem como desfazer um lançamento errado de forma segura caso a ficha técnica mude depois.

## Comportamento esperado
Todas as quatro rotas exigem autenticação JWT (`401` sem token válido):

1. **`POST /api/vendas/fechamento-manual/simulacao`**
   - Body Zod: `{ data?: "AAAA-MM-DD", itens: [{ produtoId: uuid, quantidade: int (1..500) }] }` (`1..100` itens).
   - **NÃO grava nada no banco** (sem criar `Venda` nem alterar saldos).
   - Reaproveita a lógica de expansão/consumo (`fatorPerdaSeguro`) e devolve por insumo: `consumo`, `estoqueAtual`, `estoqueProjetado` e `ficariaNegativo`, além da lista de produtos sem ficha técnica.

2. **`POST /api/vendas/fechamento-manual`**
   - Body Zod:
     - `chaveIdempotencia`: **OBRIGATÓRIA**, `string` de `8` a `100` caracteres (`trim`).
     - `data`: opcional `"AAAA-MM-DD"` (padrão: hoje no fuso `America/Campo_Grande` via `parsearDiaLoja`); rejeita datas futuras ou inexistentes no calendário com `400`.
     - `itens`: array de `1` a `100` itens `{ produtoId: uuid, quantidade: int (1..500) }`. Se houver o mesmo `produtoId` repetido na lista, somar as quantidades (respeitando a validação de entrada).
     - `observacao`: opcional, `string` até `500` caracteres.
   - Em **uma única transação (`prisma.$transaction`)**:
     - Cria **uma** `Venda` com `origem = 'MANUAL'`, `registradoPorId` do JWT, `processado = true`, `externalId = "manual:" + chaveIdempotencia` e `ocorridoEm` = **meio-dia (`12:00:00`) da `data` informada no fuso `America/Campo_Grande`** (evita ambiguidade de fronteira de dia/fuso).
     - Grava `payloadOriginal` no formato oficial:
       ```json
       {
         "info": {
           "id": "<externalId>",
           "check": 1,
           "items": [{ "name": "<Produto.nome>", "quantity": 2 }]
         },
         "origem": "manual",
         "data": "AAAA-MM-DD",
         "observacao": "...",
         "_fechamento": {
           "consumos": [{ "insumoId": "...", "quantidade": 120 }]
         }
       }
       ```
     - **Reaproveita `planejarConsolidacao` / a lógica de baixa existente** dentro da mesma transação (não duplicar cálculo de consumo nem de `fatorPerdaSeguro`). O snapshot `_fechamento.consumos` registra exatamente o consumo baixado por insumo.
   - **Atomicidade e estoque negativo:** produto inexistente ou sem ficha técnica → HTTP `422` para o pedido **inteiro**, abortando a transação sem baixar nenhum insumo. Estoque pode ficar negativo; a resposta devolve `insumosComEstoqueNegativo` (mesmo padrão da consolidação).
   - **Idempotência e concorrência:**
     - Primeira chamada bem-sucedida → `201` (ou `200` com `reaproveitado: false`, padronizar e documentar em `docs/api.md`).
     - Mesma `chaveIdempotencia` + mesmo corpo → `200` devolvendo o resultado anterior com `reaproveitado: true`, sem baixar novamente.
     - Mesma `chaveIdempotencia` + corpo diferente → `409 Conflict`.
     - Duas requisições simultâneas com a mesma chave: somente uma executa a baixa; a outra trata a violação de unicidade de `externalId` (`P2002`) como replay (validando equivalência de corpo: `200` com `reaproveitado: true` ou `409` se o corpo divergir).

3. **`POST /api/vendas/:id/estornar`**
   - Body Zod: `{ motivo: string (1..500) }`.
   - Em transação atômica: aceita apenas vendas com `origem = 'MANUAL'` e ainda não estornadas.
   - Venda com `origem = 'WEBHOOK'` → `400` ou `403` com mensagem clara.
   - Segunda tentativa de estorno na mesma venda → `409 Conflict`.
   - Devolve ao estoque **exatamente** o snapshot gravado em `payloadOriginal._fechamento.consumos` (NÃO recalcular pela ficha técnica atual, pois a ficha pode ter sido alterada depois do fechamento).
   - Grava `_estorno: { usuarioId, em, motivo }` dentro de `payloadOriginal` mantendo `_fechamento` intacto.

4. **`GET /api/vendas/fechamentos-manuais?data=AAAA-MM-DD`**
   - Lista vendas `MANUAL` filtrando por `ocorridoEm` no dia informado no fuso `America/Campo_Grande` (mais novas primeiro), contendo itens, observação, usuário (`nome`), flag `estornada` e `criadoEm`.

### Regras transversais e documentação
- Vendas `MANUAL` já nascem com `processado = true`: `POST /api/vendas/consolidar` e `POST /api/vendas/marcar-tratadas` **não** as processam nem as sobrescrevem.
- **Aviso operacional em `docs/api.md`:** não lançar fechamento manual para um dia já coberto pela integração real via webhook (risco de baixa duplicada no estoque). Registrar em `docs/requests.md` a decisão pendente para o dono sobre bloqueio/convivência quando houver vendas `WEBHOOK` no mesmo dia.

## Teste que deve falhar antes
- Sem JWT → `401` em todas as rotas.
- `POST /api/vendas/fechamento-manual`: `400` para `itens` vazios, `quantidade <= 0` ou `> 500`, `data` futura em MS, `chaveIdempotencia` ausente ou com `< 8` caracteres.
- `POST /api/vendas/fechamento-manual/simulacao`: retorna consumo projetado (com `fatorPerdaSeguro`) e `ficariaNegativo`, deixando a contagem de `vendas` e os saldos de `insumos` idênticos antes e depois.
- Fechamento de `2 BACON HOUSE` + `1 Coca Cola Zero 350ml` grava `Venda` (`origem: 'MANUAL'`, `processado: true`, `registradoPorId`, `ocorridoEm` ao meio-dia em MS, `payloadOriginal` completo com `_fechamento.consumos`) e abate todos os ingredientes, embalagens e a bebida `1:1`.
- Replay idempotente: repetir mesma `chaveIdempotencia` + mesmo corpo retorna `200` com `reaproveitado: true` e não abate de novo; mesma chave + corpo diferente retorna `409`.
- Produto inexistente ou sem ficha técnica no meio da lista retorna `422` e não altera nenhum insumo nem cria `Venda`.
- Concorrência real (`Promise.all`) com chaves diferentes no mesmo insumo preserva o saldo final exato; com a mesma chave baixa uma única vez e a segunda chamada vira replay.
- `POST /api/vendas/:id/estornar`: devolve exatamente o snapshot `_fechamento.consumos` mesmo se a ficha técnica do produto for alterada depois do fechamento; segundo estorno retorna `409`; tentar estornar venda `WEBHOOK` retorna `400`/`403`.
- `GET /api/vendas/fechamentos-manuais?data=...` lista as vendas do dia ordenadas das mais novas às mais antigas com `usuario.nome`, itens, `observacao` e `estornada`.
- `POST /api/vendas/consolidar` e `POST /api/vendas/marcar-tratadas` ignoram vendas `MANUAL`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, mais teste de mutação (`>= 85%`) no serviço de escrita (cada sobrevivente justificado um a um).
- [ ] Reaproveitamento de `planejarConsolidacao` / baixa transacional existente verificado em revisão (sem cálculo duplicado).
- [ ] `docs/api.md` atualizado no mesmo commit (com o aviso de risco de baixa dupla com webhook); pendência de convivência registrada/atualizada em `docs/requests.md`; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma`, implementar entrada manual de estoque (tarefa 23) ou construir a tela no frontend.
