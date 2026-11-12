# 10 — Rota para listar as vendas retidas e o motivo de cada uma

- **Tipo:** feat · **Estado:** PENDENTE (sem schema novo)
- **Origem:** `docs/PLANO_PRODUCAO.md` Fase 1, item 2 ("alerta exposto ... na API para o operador
  resolver no cardápio"); revisão de prontidão para o payload real (11/11/2026)
- **Arquivos:** `backend/src/modules/vendas/services/planejar_consolidacao.ts`,
  `backend/src/modules/vendas/repositories/vendas.repository.ts` (`buscarNaoProcessadas` ~48),
  novo controller e `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md` §5
- **Branch sugerida:** `feat/backend-vendas-retidas`

## Contexto
A consolidação não abate venda com produto fora do catálogo, sem ficha, com item inválido ou nome em
colisão: ela fica `processado: false` e só aparece como **contagem** na resposta de
`POST /api/vendas/consolidar` (`vendasPendentesNaoMapeadas`, `produtosNaoEncontrados`, ...). Quem chama
essa rota é o cron. Em operação, ninguém vê que o estoque parou de baixar.

## Comportamento esperado
- `GET /api/vendas/retidas` (JWT; papel a definir na tarefa 13 — por ora qualquer logado) devolve, para
  cada venda não processada que **não** está só aguardando estado (`check` 0/-2/-1/-3/6):
  `{ id, externalId, criadoEm, check, motivos: [{ tipo: "PRODUTO_NAO_ENCONTRADO" | "PRODUTO_SEM_FICHA" | "ITEM_INVALIDO" | "COLISAO_NOME" | "SEM_ITENS", detalhe }] }`
  e um resumo agregado por produto (`"X-Tudo": 7 vendas`) para o operador corrigir o cardápio de uma vez.
- Reaproveitar o planejador em modo leitura (o mesmo usado pelo `scripts/replay-vendas.ts`) — **não**
  duplicar a lógica de casamento de nomes. Rode `graphify affected "planejarConsolidacao()"` antes.
- Paginado ou limitado (ex.: 200 mais antigas) e documentado.
- Vendas aguardando estado ficam numa contagem separada (`aguardandoEstado`), não na lista.

## Teste que deve falhar antes
- Com uma venda de produto inexistente e outra cancelada (descartável) e outra agendada:
  a rota lista **só** a primeira, com motivo `PRODUTO_NAO_ENCONTRADO` e o nome do produto; agendada
  conta em `aguardandoEstado`. Hoje a rota não existe (404).
- Sem JWT → 401.
- Depois de cadastrar o produto com ficha e consolidar, a venda some da lista (teste com banco de teste).

## Critério de pronto
- [ ] Testes falhando antes e passando depois (unitário do agregador + HTTP com banco de teste).
- [ ] `docs/api.md` §5 com a rota nova; uma linha nova em `app.ts`/rotas, seguindo o `AGENTS.md`.
- [ ] Registrar em `docs/tarefas/frontend/` uma tarefa nova para a tela (só o MD, o FRONT implementa).

## Fora do escopo
Gravar o motivo no banco (`motivoPendencia` no schema) — se for preciso, peça ao DB em `docs/requests.md`.
