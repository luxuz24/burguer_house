# 09 — `bodyLimit` explícito no Fastify

- **Tipo:** fix (higiene HTTP) · **Estado:** PENDENTE
- **Origem:** `docs/PLANO_PRODUCAO.md`, Fase 3 ("`bodyLimit` explícito no Fastify")
- **Arquivos:** `backend/src/infra/http/app.ts` (~18, `Fastify({...})`), rotas de nota fiscal e webhook
  (só leitura), `backend/src/infra/http/app.spec.ts`, `docs/api.md`
- **Branch sugerida:** `fix/backend-bodylimit`

## Contexto
O app não define `bodyLimit`, então vale o padrão do Fastify (1 MiB) por acaso. O parser de XML limita
o arquivo a 500 KB dentro do serviço, mas o corpo inteiro (XML em JSON, payload do webhook) chega antes.
O encerramento gracioso já existe (`server.ts`, `SIGTERM`), então esta tarefa é só o limite.

## Comportamento esperado
- `bodyLimit` global explícito e pequeno (ex.: 256 KB) no `Fastify({...})`, com comentário do porquê.
- Rotas que precisam de mais declaram o próprio limite na rota (`{ bodyLimit: ... }`):
  `POST /api/notas-fiscais/parser-xml` (XML de até 500 KB **escapado em JSON** → ~1 MB) e
  `POST /api/webhook/anota-ai` (meça um payload grande de `fixtures/anotaai/` e dê folga).
- Corpo acima do limite → **413** com mensagem em português pelo `error_handler.ts`
  (`FST_ERR_CTP_BODY_TOO_LARGE`), não 500.
- Documentar os limites no `docs/api.md`.

## Teste que deve falhar antes
- `POST /api/insumos` com corpo de 300 KB → **413**. Hoje aceita (limite de 1 MiB).
- `POST /api/notas-fiscais/parser-xml` com XML de 480 KB → **não** é recusado pelo limite.
- Mensagem do 413 em português.

## Critério de pronto
- [x] Testes falhando antes (saída no PR) e passando depois.
- [x] Todos os specs HTTP existentes seguem verdes (nenhum payload de fixture estoura o limite).
- [x] `docs/api.md` com os limites.
