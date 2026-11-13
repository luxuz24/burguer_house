# 09 — Tela / alerta para visualizar vendas retidas e corrigir cardápio

- **Tipo:** feat · **Estado:** PENDENTE
- **Origem:** Tarefa BACK 10 (`GET /api/vendas/retidas`, `docs/tarefas/backend/10-vendas-retidas-listagem.md`)
- **Arquivos sugeridos:** `frontend/src/pages/` (Início ou nova subseção em Produtos/Fichas), `frontend/src/lib/`
- **Branch sugerida:** `feat/frontend-vendas-retidas`

## Contexto
Quando uma venda da Anota AI chega com um produto fora do catálogo, sem ficha técnica, com colisão de nome ou item inválido, o backend retém essa venda (`processado = false`) e a expõe em `GET /api/vendas/retidas` com a lista individual e `resumoPorProduto`.

## Problema
Hoje não existe visualização dessas vendas retidas no frontend, então o operador não descobre que precisa cadastrar/corrigir um produto no cardápio para liberar a baixa automática do estoque.

## Comportamento esperado
- Exibir um indicador/alerta quando `totalRetidas > 0` (no Início e/ou na tela de Produtos/Fichas).
- Listar o `resumoPorProduto` (`"X-Tudo": 7 vendas` + `tipo` do motivo) com atalho direto para criar/editar o produto ou ficha técnica correspondente.
- Mostrar também a lista detalhada (`externalId`, data, `motivos`) e informar a contagem separada de `aguardandoEstado` sem misturá-la às vendas com erro.
- Respeitar design tokens (claro/escuro), alvos de toque ≥ 44px e testes de componente.

## Teste que deve falhar antes
- Renderizar com mock de `GET /api/vendas/retidas` retornando `totalRetidas: 2` e `resumoPorProduto: [{ produto: 'X-Tudo', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 2 }]` → exibe o alerta e o resumo acionável; com `totalRetidas: 0` → oculta o alerta.

## Critério de pronto
- [ ] `npm --prefix frontend run lint`, `test` e `build` verdes.
- [ ] Conferência visual em claro, escuro e 375px.

## Fora do escopo
Alterar a rota de backend ou persistir `motivoPendencia` no banco.
