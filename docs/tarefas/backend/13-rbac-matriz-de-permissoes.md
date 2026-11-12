# 13 — Aplicar a matriz de permissões (RBAC) nas rotas

- **Tipo:** feat (segurança) · **Estado:** BLOQUEADA — o dono precisa aprovar a matriz de quem pode o quê
- **Origem:** `docs/requests.md` → "Segurança do auth: pedidos abertos" (decisão da matriz) e
  "[Auth / RBAC] Refinamento da Matriz de Permissões para Telas do Frontend" (09/11/2026);
  `docs/PLANO_PRODUCAO.md` Fase 3 ("RBAC Ativo")
- **Arquivos:** `backend/src/infra/http/role.guard.ts` (`exigirRole`, já existe e tem spec),
  `backend/src/infra/http/routes/*.routes.ts`, controller do dashboard e de perdas, `docs/api.md`
- **Branch sugerida:** `feat/backend-rbac-rotas`

## Contexto
O guard global já lê `ativo`, `role` e `tokenVersion` do banco a cada requisição, e `exigirRole(...)`
existe com testes, mas **nenhuma rota o usa**: qualquer usuário logado faz tudo. O `docs/api.md` diz
"Autorização por role ainda não é aplicada".

## O que o dono precisa decidir (proposta de partida em `docs/requests.md`)
1. OPERADOR: registra perdas e produção (`POST /api/perdas`, `POST /api/preparo-interno/produzir`)?
2. Fichas técnicas, sub-fichas, insumos (cadastro) e notas fiscais: só ADMIN, ou ADMIN e GERENTE?
3. `GET /api/dashboard/resumo`: o Início do OPERADOR chama essa rota — liberar um resumo operacional para
   todos e restringir valores financeiros? O OPERADOR vê R$ em Perdas (`resumo-mensal`)?

## Comportamento esperado (depois da decisão)
- Cada rota restrita usa `preHandler: exigirRole(...)` conforme a matriz aprovada.
- Onde a matriz pede "mesma rota, menos campos" (ex.: R$ para OPERADOR), o controller omite os campos
  — sem criar rota nova, para o frontend não quebrar.
- Tabela da matriz no `docs/api.md` e coluna "papéis" em cada rota.

## Teste que deve falhar antes
Para **cada** rota restrita: OPERADOR → **403**; papel permitido → 2xx. Hoje 2xx para todos.
Rotas abertas a todos os logados continuam 2xx para OPERADOR (regressão do Início).

## Critério de pronto
- [ ] Matriz aprovada pelo dono anexada ao PR.
- [ ] Um teste 403 por rota restrita; testes existentes verdes.
- [ ] `docs/api.md` atualizado; tarefa nova no `docs/tarefas/frontend/` se alguma tela precisar
      esconder ações por papel.
