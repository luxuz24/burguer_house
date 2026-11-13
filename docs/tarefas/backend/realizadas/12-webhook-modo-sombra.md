# 12 — Modo sombra do webhook da Anota AI

- **Tipo:** feat · **Estado:** PENDENTE (sem schema novo)
- **Origem:** `docs/PLANO_PRODUCAO.md` Fase 5, passo 1 ("modo sombra: grava o payload bruto sem
  consolidar"); revisão de prontidão para o payload real (11/11/2026)
- **Arquivos:** `backend/src/modules/vendas/services/consolidacao.service.ts`,
  `backend/src/infra/http/controllers/webhook.controller.ts` (só leitura),
  `backend/scripts/replay-vendas.ts`, `backend/.env.example`, `docs/api.md` §5, `docs/arquitetura.md`
- **Branch sugerida:** `feat/backend-modo-sombra`

## Contexto
O formato real do webhook nunca foi visto: o adaptador (`anotaai.adapter.ts`) e as fixtures vêm da
documentação pública. No período de teste da Anota AI (7 dias), o plano é **receber e guardar** os
pedidos reais sem mexer no estoque, gerar fixtures a partir deles e passar o replay antes de ligar a
consolidação de verdade.

## Comportamento esperado
- Variável `ANOTAAI_MODO_SOMBRA=true|false` (padrão `false`), documentada no `.env.example`.
- Com `true`:
  - o webhook continua validando o segredo e **gravando** a venda como hoje (`payloadOriginal`, dedup
    por `externalId`);
  - `POST /api/vendas/consolidar` **não abate estoque nem marca processado**: devolve o plano em
    dry-run (o mesmo espelho do `replay-vendas.ts`) com `modoSombra: true` na resposta;
  - log de nível `info` por evento recebido com `externalId`, `check` e quantidade de itens (sem dados
    pessoais do cliente: nada de nome, telefone, endereço do payload).
- Com `false`: comportamento atual, byte a byte.
- Script para exportar os payloads gravados como fixtures anonimizadas
  (ex.: `npm --prefix backend run exportar:fixtures`), removendo dados pessoais.

## Teste que deve falhar antes
- Com `ANOTAAI_MODO_SOMBRA=true`, uma venda válida + consolidar → estoque **inalterado**,
  `processado` continua `false`, resposta com `modoSombra: true` e o plano. Hoje abate.
- Com `false` (ou ausente) → abate como hoje (regressão).
- Exportador: payload com nome/telefone/endereço → fixture sem esses campos.

## Critério de pronto
- [x] Testes falhando antes e passando depois (banco de teste para a consolidação).
- [x] `.env.example`, `docs/api.md` §5 e `docs/arquitetura.md` atualizados.
- [x] Passo a passo do período de teste escrito em `docs/` (ligar sombra → coletar → exportar fixtures →
      replay → desligar sombra).

## Fora do escopo
Ajustar o adaptador ao formato real (só depois de ter os payloads; ver tarefas 17 e 18).
