# 22 — Fechamento manual do dia (`POST /api/vendas/fechamento-manual`)

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `OrigemVenda`, `registradoPorId`, `ocorridoEm`)
- **Origem:** Pedido da hamburgueria (baixa de estoque pelos pedidos vendidos antes da integração com a Anota AI)
- **Arquivos:** `backend/src/modules/vendas/`, `backend/src/infra/http/controllers/`,
  `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md`
- **Branch sugerida:** `feat/backend-fechamento-manual-dia`

## Contexto
Enquanto a integração automática com a Anota AI não está ativa em produção, o operador precisa lançar ao final do dia os produtos vendidos (lanches e bebidas) para baixar o estoque usando as fichas técnicas já cadastradas. A tabela `vendas` já possui `origem` (`WEBHOOK` | `MANUAL`), `registradoPorId` (`Usuario` do JWT) e `ocorridoEm`.

## Comportamento esperado
- `POST /api/vendas/fechamento-manual` (exige JWT):
  - Body validado com Zod: `{ data?: "AAAA-MM-DD", itens: [{ produtoId: uuid, quantidade: int > 0 }], chaveIdempotencia?: string, observacao?: string }` (`itens` não vazio).
  - Interpreta `data` no fuso `America/Campo_Grande` (padrão: hoje no fuso da loja), rejeitando data futura com `400` (`parsearDiaLoja`). Grava em `Venda.ocorridoEm`.
  - Se `chaveIdempotencia` for enviada, usa `externalId` único (ex.: `manual:${chaveIdempotencia}`) para garantir idempotência sem duplicar baixa em reenvio (`409` ou retorno idempotente conforme contrato definido em `docs/api.md`).
  - Em transação atômica (`prisma.$transaction`), expande as fichas técnicas (incluindo embalagens vinculadas ao produto e bebidas 1:1), abate o estoque dos insumos respeitando `fatorPerdaSeguro` (permitindo saldo negativo como na consolidação e sinalizando `estoqueNegativo` na resposta), e cria `Venda` com `origem: 'MANUAL'`, `processado: true`, `registradoPorId` do JWT, `ocorridoEm` e resumo estruturado em `payloadOriginal`.
  - Produto inexistente ou sem ficha técnica retorna `400`/`404` ou `422` (sem baixar parcialmente nenhum outro item).
- Atualizar `docs/api.md` com rota, request, response e erros.

## Teste que deve falhar antes
- Sem JWT → `401`.
- Body vazio ou quantidade `<= 0` ou data futura em MS → `400`.
- Fechamento de 2 `BACON HOUSE` + 1 `Coca Cola Zero 350ml` cria `Venda` com `origem: 'MANUAL'`, `processado: true`, `registradoPorId` preenchido, `ocorridoEm` correspondente à data informada, e abate todos os insumos + embalagens + bebida em uma única transação.
- Reenvio com a mesma `chaveIdempotencia` não abate estoque duas vezes.
- Produto inexistente no meio da lista aborta a transação sem alterar o estoque de nenhum item.
- Chamadas concorrentes no mesmo insumo preservam consistência do saldo final.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test` e teste de mutação (`>= 85%`) no serviço de escrita.
- [ ] Consolidação automática (`POST /api/vendas/consolidar`) ignorando `MANUAL` / `processado: true` garantido por teste.
- [ ] `docs/api.md` atualizado no mesmo commit; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma` ou implementar a tela de fechamento no frontend.
