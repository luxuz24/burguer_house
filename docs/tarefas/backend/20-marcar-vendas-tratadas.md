# 20 — Endpoint para marcar vendas acumuladas em modo sombra como tratadas

- **Tipo:** feat · **Estado:** FEITA (#96) (sem schema novo)
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
  - Body validado com Zod: `{ ate: "AAAA-MM-DD", motivo: string, simulacao?: boolean }` (`motivo` obrigatório e não vazio após `trim`; `simulacao` padrão `false`).
  - Interpreta `ate` como o fim do dia (`23:59:59.999`) no fuso da loja (`America/Campo_Grande`) via
    `parsearDiaLoja(ate, 'fim')`, rejeitando datas inexistentes no calendário (ex.: `2026-02-31`) e
    datas futuras em relação a hoje em `America/Campo_Grande` (`"A data não pode ser futura"`) com HTTP `400`.
  - Com `simulacao: true`, conta quantas vendas seriam atingidas sem alterar o banco e devolve `{ marcadas, ate, simulacao: true }`.
  - Com `simulacao: false`, executa **uma única atualização SQL em lote (`$executeRaw`)** marcando como `processado: true` apenas as vendas ainda pendentes (`processado = false`) com `criadoEm <= fimDoDia(ate)`, **sem abater estoque** (evitando timeout da transação interativa em volumes altos).
  - Registra em `payloadOriginal._tratamento` os metadados `{ motivo, ate, marcadoEm, usuarioId }` preservando os
    campos originais do pedido (ou encapsulando payloads array/`null` em `{ valorOriginal, _tratamento }`) para auditoria (sem alterar o schema).
  - É idempotente: repetir a chamada na mesma data com todas as vendas já tratadas retorna
    `200 { marcadas: 0, ate }`.

## Teste que deve falhar antes
- Sem JWT → `401`.
- Com data inválida (`2026-02-31`), data futura (amanhã em MS) ou `motivo` vazio → `400`.
- `simulacao: true` conta as pendentes (inclusive `check: 0`) sem alterar `processado`, e a chamada real seguinte marca a mesma quantidade.
- Volume em lote: 3.000 vendas pendentes antigas (com payloads objeto, array e `null`) processadas em `< 2 s` respeitando os filtros `WHERE`.
- Auditoria: `payloadOriginal._tratamento.usuarioId` corresponde ao usuário autenticado no JWT.
- Com duas vendas pendentes (uma de ontem às 23:59 MS e outra de hoje às 00:05 MS),
  chamar `POST /api/vendas/marcar-tratadas` para ontem retorna `{ marcadas: 1, ate }`; chamar de novo retorna `marcadas: 0`; o estoque não muda;
  rodar `POST /api/vendas/consolidar` em seguida consolida apenas a segunda venda (abate estoque de 10 para 9).

## Critério de pronto
- [x] Testes falhando antes (RED) e passando depois (GREEN), incluindo teste HTTP no banco de teste e teste de mutação (`>= 85%`) no serviço de escrita.
- [x] Desempenho em lote validado (3.000 vendas marcadas em um único `UPDATE` abaixo de 2 s, preservando objeto, array e `null`).
- [x] Travas implementadas e testadas: bloqueio de data futura em MS, modo `simulacao: true` e auditoria com `usuarioId`.
- [x] `docs/api.md` §5 documentando a rota, modo de simulação e todos os avisos operacionais.
- [x] `docs/MODO_SOMBRA_ANOTAAI.md` §5 apontando para o novo endpoint com avisos e fluxo de simulação.

## Fora do escopo
Alterar `backend/prisma/schema.prisma` ou criar coluna dedicada de auditoria/usuário (coberto em tarefa futura de schema).
