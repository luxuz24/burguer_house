# 23 — Entrada manual de estoque (`POST /api/estoque/entrada-manual` e histórico)

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `MovimentacaoEstoque`)
- **Origem:** Pedido da hamburgueria (dar entrada no estoque quando a nota fiscal foi perdida)
- **Arquivos:** `backend/src/modules/insumos/` (ou `movimentacoes/`), `backend/src/infra/http/controllers/`,
  `backend/src/infra/http/routes/`, `docs/api.md`
- **Branch sugerida:** `feat/backend-entrada-manual-estoque`

## Contexto
Hoje o saldo de insumos só aumenta via importação de XML de Nota Fiscal ou produção interna. Quando a loja perde a nota fiscal de uma compra (especialmente bebidas, embalagens ou hortifrúti), o operador não tem como dar entrada com trilha de auditoria. A tabela `movimentacoes_estoque` (`MovimentacaoEstoque`, tipo `ENTRADA_MANUAL`) já está disponível no schema.

## Comportamento esperado
- `POST /api/estoque/entrada-manual` (ou `/api/insumos/:id/entrada-manual` — documentar a escolha final em `docs/api.md`, exige JWT):
  - Body Zod: `{ insumoId: uuid, quantidade: number > 0, custoUnitario?: number >= 0, observacao?: string, chaveIdempotencia?: string }`.
  - Em transação atômica com lock/leitura consistente no Postgres (`FOR UPDATE` ou update atômico no padrão do projeto): lê `saldoAnterior`, calcula `saldoPosterior = saldoAnterior + quantidade`, incrementa `insumo.estoqueAtual` (e atualiza `custoUnitario` do insumo se informado e desejado — deixar regra explícita e documentada), grava `MovimentacaoEstoque` com `tipo: 'ENTRADA_MANUAL'`, `quantidade`, `saldoAnterior`, `saldoPosterior`, `custoUnitario`, `observacao`, `chaveIdempotencia` e `usuarioId` do JWT.
  - Se `chaveIdempotencia` já existir (P2002 / verificação prévia), não duplica o incremento no estoque e responde idempotente (`200`/`409` conforme contrato em `docs/api.md`).
  - Insumo inexistente → `404`. Quantidade `<= 0` ou `custoUnitario < 0` → `400`.
- `GET /api/estoque/movimentacoes` (ou por insumo `?insumoId=`): listar histórico recente com `usuario` e `insumo` para conferência e tela.
- Atualizar `docs/api.md` no mesmo commit.

## Teste que deve falhar antes
- Sem JWT → `401`.
- Quantidade `<= 0` ou `custoUnitario` negativo → `400`; insumo inexistente → `404`.
- Entrada manual de `+24` incrementa `estoqueAtual` de `10` para `34` e grava `MovimentacaoEstoque` com `saldoAnterior: 10`, `saldoPosterior: 34`, `tipo: 'ENTRADA_MANUAL'` e `usuarioId` do JWT.
- Reenvio com a mesma `chaveIdempotencia` não soma estoque duas vezes.
- Duas entradas concorrentes (`Promise.all`) resultam em saldo final exato (`10 + 5 + 8 = 23`) e dois registros coerentes de movimentação.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, incluindo teste de concorrência real e teste de mutação (`>= 85%`) no serviço de escrita.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado no mesmo commit; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Implementar `AJUSTE` de inventário (segue na tarefa `14-ajuste-inventario-estoque.md`, que reutilizará o mesmo model `MovimentacaoEstoque`), alterar schema ou criar UI no frontend.
