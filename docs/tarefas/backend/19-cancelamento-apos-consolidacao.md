# 19 — Pedido cancelado depois da consolidação

- **Tipo:** feat · **Estado:** BLOQUEADA — decisão do dono e, se for estornar, campo novo (agente DB)
- **Origem:** `docs/requests.md` → "Decisões pendentes do dono da loja (BACK)", itens de cancelamento
- **Arquivos:** `backend/src/modules/vendas/repositories/vendas.repository.ts` (`salvar`, tratamento de
  evento repetido), `backend/src/modules/vendas/services/estado_pedido.ts`,
  `backend/src/modules/vendas/services/consolidacao.service.ts`, `docs/api.md` §5

## Problema
Um evento de cancelamento (`check` 4/5/-4/41/42) que chega **depois** da consolidação não muda nada:
a venda já foi abatida e não é reescrita. Se o pedido foi cancelado antes de preparar, o estoque
deveria voltar; se já foi preparado, o certo é uma perda. Hoje o evento é engolido sem registro visível.

## Decisões do dono
1. Cancelado depois de consolidado: **estornar** o estoque, **registrar perda**, ou só **avisar**?
2. Cancelado antes de consolidar mas depois de preparado (`check` 1/2): o operador registra a perda à
   mão (hoje) — aceitável?
3. A loja usa pedido agendado (`check` -2)?

## Comportamento esperado (mínimo, já útil sem estorno)
- O cancelamento pós-consolidação fica **registrado** e aparece na listagem de retidas/avisos
  (tarefa 10) como `CANCELADO_APOS_ABATIMENTO`, para o operador decidir.
- Se o dono escolher estorno: campo `Venda.estoqueAbatido`/`estornadoEm` (agente DB) para o estorno
  ser idempotente; estorno na mesma transação que marca a venda; teste de duplo evento.

## Teste que deve falhar antes
- Venda consolidada + evento de cancelamento com o mesmo `externalId` → aparece como aviso
  `CANCELADO_APOS_ABATIMENTO`. Hoje some.
- (estorno) dois eventos de cancelamento iguais → estoque devolvido **uma** vez.

## Critério de pronto
- [ ] Decisões registradas; schema (se houver) aplicado pelo dono do schema.
- [ ] Testes falhando antes e passando depois, com banco de teste.
- [ ] `docs/api.md` §5 atualizado.
