# 17 — Vincular produto pelo ID da Anota AI (`codigoExterno`)

- **Tipo:** feat · **Estado:** BLOQUEADA — schema (agente DB) **e** payload real (saber qual campo é o ID do item)
- **Origem:** `docs/PLANO_PRODUCAO.md` Fase 1, item 3; revisão de prontidão para o payload real (11/11/2026)
- **Arquivos:** `backend/src/modules/vendas/services/anotaai.adapter.ts`,
  `backend/src/modules/vendas/services/planejar_consolidacao.ts`, CRUD de produtos, `docs/api.md`

## Problema
Hoje o item da venda casa com o produto só pelo **nome normalizado**. Se o nome no cardápio da Anota AI
for diferente do cadastro ("X-Tudo da Casa" × "X-Tudo"), toda venda daquele produto fica retida. O nome
pode mudar no cardápio a qualquer momento.

## Depois do desbloqueio
- Agente DB: `Produto.codigoExterno String? @unique`.
- Adaptador: extrair o ID do item do payload real (campo confirmado com as fixtures da tarefa 12).
- Planejador: casar **primeiro** por `codigoExterno`, depois por nome normalizado (fallback atual).
- CRUD de produtos aceita `codigoExterno` (Zod, opcional, único → 409).
- Opcional: ao casar por nome um item que traz ID e o produto ainda não tem `codigoExterno`, sugerir o
  vínculo na listagem de retidas (tarefa 10) — não gravar sozinho.

## Teste que deve falhar antes
- Venda com item `{ id: "abc", nome: "X-Tudo da Casa" }` e produto `"X-Tudo"` com
  `codigoExterno: "abc"` → abatida. Hoje retida.
- Item sem ID → cai no casamento por nome (regressão de todas as fixtures).

## Critério de pronto
- [ ] Campo confirmado em payload real (fixture anexada) e migration aplicada.
- [ ] Testes falhando antes e passando depois; replay das fixtures reais sem retidas inesperadas.
- [ ] `docs/api.md` (produtos e consolidação) atualizado.
