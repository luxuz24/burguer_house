# 16 — Índice único de `nomeNormalizado` em `Produto`

- **Tipo:** fix (integridade) · **Estado:** BLOQUEADA — mudança de schema (agente DB / humano)
- **Origem:** `docs/requests.md` → "[Fase 3] Coluna / Índice Único sobre `nomeNormalizado` em `Produto`" (03/11/2026)
- **Arquivos:** `backend/src/modules/produtos/repositories/` (criar/atualizar),
  `backend/src/shared/nomes.ts` (`normalizarNomeProduto`), specs de produtos; schema e migration são do agente DB

## Problema
A unicidade de nome canônico (`"X-Bacon"` = `"X Bacon"` = `"x bacon"`) é checada só na aplicação, com
leitura seguida de escrita. Dois cadastros simultâneos passam pela checagem e gravam duplicado; a
consolidação de vendas então encontra **colisão de nomes** e retém as vendas desse produto.

## Depois que o agente DB criar `nomeNormalizado String @unique` (com backfill)
- O repositório grava `nomeNormalizado = normalizarNomeProduto(nome)` em criar/atualizar.
- `P2002` nesse campo vira **409** com a mesma mensagem de hoje (o `error_handler.ts` já trata P2002).
- A checagem prévia pode ficar (mensagem melhor), mas a garantia passa a ser o banco.
- O planejador da consolidação pode buscar por `nomeNormalizado` (avaliar com `graphify affected`).

## Teste que deve falhar antes (banco de teste)
- Dois `POST /api/produtos` concorrentes (`Promise.all`) com `"X-Bacon"` e `"x bacon"` → um 201 e um
  **409**, e só um produto no banco. Hoje os dois podem passar.

## Critério de pronto
- [ ] Migration com backfill aplicada pelo dono do schema (e duplicados existentes resolvidos antes).
- [ ] Teste de concorrência real falhando antes e passando depois.
- [ ] Entrada do `requests.md` marcada RESOLVIDO.
