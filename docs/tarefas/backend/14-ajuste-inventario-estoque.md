# 14 — Ajuste e inventário de estoque

- **Tipo:** feat · **Estado:** BLOQUEADA — decisão do dono (opção A ou B) e, na opção A, model novo
  pelo agente DB / humano
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
- [ ] Decisão registrada; migration feita pelo dono do schema (não por este agente).
- [ ] Testes falhando antes e passando depois; mutação ≥ 85% no use case.
- [ ] `docs/api.md` e `docs/PLANO.md` coerentes; tarefa de tela criada em `docs/tarefas/frontend/`.
