# 20 — Endpoint para marcar vendas acumuladas em modo sombra como tratadas

- **Tipo:** feat · **Estado:** PENDENTE (sem schema novo)
- **Origem:** Fechamento da Fase 1 / Modo sombra (`docs/MODO_SOMBRA_ANOTAAI.md` §5)
- **Arquivos:** `backend/src/modules/vendas/services/marcar_vendas_tratadas.service.ts`,
  `backend/src/infra/http/controllers/marcar_vendas_tratadas.controller.ts`,
  `backend/src/infra/http/routes/vendas.routes.ts`, `docs/api.md` §5, `docs/MODO_SOMBRA_ANOTAAI.md`
- **Branch sugerida:** `feat/backend-marcar-vendas-tratadas`

## Contexto
Durante os dias de operação em **modo sombra** (`ANOTAAI_MODO_SOMBRA=true`), os pedidos recebidos
em `POST /api/webhook/anota-ai` acumulam na tabela `vendas` com `processado: false`. Se o dono
optar por fazer o inventário manual antes de ativar a baixa automática (`ANOTAAI_MODO_SOMBRA=false`),
a próxima execução de `POST /api/vendas/consolidar` abateria novamente todas as vendas pendentes
daquela semana — gerando desconto duplicado no estoque.

## Comportamento esperado
- `POST /api/vendas/marcar-tratadas` (exige autenticação JWT):
  - Body validado com Zod: `{ ate: "AAAA-MM-DD", motivo: string }` (`motivo` obrigatório e não vazio após `trim`).
  - Interpreta `ate` como o fim do dia (`23:59:59.999`) no fuso da loja (`America/Campo_Grande`) via
    `parsearDiaLoja(ate, 'fim')`, rejeitando datas inexistentes no calendário (ex.: `2026-02-31`) com HTTP `400`.
  - Dentro de transação, marca como `processado: true` apenas as vendas ainda pendentes
    (`processado: false`) com `criadoEm <= fimDoDia(ate)`, **sem abater estoque**.
  - Registra em `payloadOriginal._tratamento` os metadados `{ motivo, ate, marcadoEm }` preservando os
    campos originais do pedido para auditoria (sem alterar o schema).
  - É idempotente: repetir a chamada na mesma data com todas as vendas já tratadas retorna
    `200 { marcadas: 0, ate }`.

## Teste que deve falhar antes
- Sem JWT → `401`.
- Com data inválida (`2026-02-31`) ou `motivo` vazio → `400`.
- Com duas vendas pendentes (uma em `2026-11-10` às 23:59 MS e outra em `2026-11-11` às 00:05 MS),
  chamar `POST /api/vendas/marcar-tratadas` com `{ ate: "2026-11-10", motivo: "..." }` retorna
  `{ marcadas: 1, ate: "2026-11-10" }`; chamar de novo retorna `marcadas: 0`; o estoque não muda;
  rodar `POST /api/vendas/consolidar` em seguida consolida apenas a segunda venda (abate estoque de 10 para 9).
  Hoje a rota não existe (`404`).

## Critério de pronto
- [x] Testes falhando antes (RED) e passando depois (GREEN), incluindo teste HTTP no banco de teste e teste de mutação (`>= 85%`) no serviço de escrita.
- [x] `docs/api.md` §5 documentando a nova rota `POST /api/vendas/marcar-tratadas`.
- [x] `docs/MODO_SOMBRA_ANOTAAI.md` §5 apontando para o novo endpoint.

## Fora do escopo
Alterar `backend/prisma/schema.prisma` ou criar coluna dedicada de auditoria/usuário (coberto em tarefa futura de schema).
