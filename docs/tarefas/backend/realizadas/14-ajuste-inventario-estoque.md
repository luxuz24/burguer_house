# 14 — Ajuste e inventário de estoque

- **Tipo:** feat · **Estado:** FEITA (#120)
- **Origem:** `docs/requests.md` → "[Fase 2 / Produto] Endpoint e Estrutura para Ajuste / Inventário de Estoque" (09/11/2026)
- **Arquivos:** `backend/src/modules/insumos/` (novo use case), controller e rotas de insumos,
  `docs/api.md`, `docs/PLANO.md` (divergência na linha ~46)
- **Branch sugerida:** `feat/backend-ajuste-estoque`

## Problema
Desde o PR #54 o `PUT /api/insumos/:id` não aceita `estoqueAtual` (protege o saldo contra sobrescrita
acidental). O saldo só sobe por nota fiscal ou produção interna. Se um insumo foi cadastrado com saldo
errado, ou a contagem física diverge, o lojista não tem como corrigir sem forjar uma nota.

## Decisão pendente
- **Opção A (recomendada):** model `AjusteEstoque` (`insumoId`, `saldoAnterior`, `novoSaldo`,
  `diferenca`, `motivo`, `usuarioId`, `criadoEm`) — trilha de auditoria. Pedir ao agente DB.
- **Opção B:** atualização direta em transação + log estruturado, sem tabela.

## Decisão tomada (dono, 17/11/2026) e o que foi feito (#120)
- **Ajuste por contagem física**, em lote: `POST /api/estoque/ajustes` com
  `{ chaveIdempotencia, motivo, itens: [{ insumoId, saldoContado }] }` (contrato em `docs/api.md`).
- Trilha de auditoria na tabela que já existia: `MovimentacaoEstoque` com `tipo = AJUSTE`
  (`quantidade` = diferença com sinal, `saldoAnterior`, `saldoPosterior`, `observacao` = motivo, `usuarioId`).
  Variante da opção A **sem migration** (o enum `AJUSTE` veio no schema da Fase 2, #97).
- Histórico pelo `GET /api/estoque/movimentacoes` existente (em vez de `GET /api/insumos/:id/ajustes`).
- Papel `ADMIN`/`GERENTE` via `exigirRole`; a matriz completa continua na tarefa 13.
- Tela: tarefa front [21](../../frontend/realizadas/21-contagem-estoque-tela.md).

## Comportamento esperado (depois da decisão)
- `POST /api/insumos/:id/ajuste` com `{ novoSaldo: number >= 0, motivo: string (3..200) }`, Zod,
  transação atômica que lê o saldo atual com o mesmo padrão de concorrência das perdas/produção.
- `motivo` obrigatório; `usuarioId` do JWT.
- Papel: ADMIN/GERENTE (alinhar com a tarefa 13).
- `GET /api/insumos/:id/ajustes` (opção A) para o histórico.

## Teste que deve falhar antes
- Ajuste de 10 → 25 grava saldo 25 e (A) um registro com `diferenca: 15`. Hoje 404.
- `novoSaldo` negativo ou `motivo` vazio → 400.
- Dois ajustes concorrentes no banco de teste → saldo final é o do último e o histórico tem os dois.

## Critério de pronto
- [x] Decisão registrada (acima); sem migration, o schema já tinha `AJUSTE`.
- [x] Testes falhando antes e passando depois (7 em `ajuste_estoque.http.spec.ts`). Mutação medida à mão
  nos pontos críticos (lock, replay, papel), não com Stryker.
- [x] `docs/api.md` atualizado; tarefa de tela criada em `docs/tarefas/frontend/` (21).
  O `docs/PLANO.md` não foi alterado (fica para a próxima atualização do plano).
