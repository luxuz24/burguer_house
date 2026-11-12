# 18 — Adicionais e observações (`subItems`) na consolidação

- **Tipo:** feat · **Estado:** BLOQUEADA — payload real da Anota AI e decisão do dono sobre adicionais pagos
- **Origem:** `docs/requests.md` → "Decisões pendentes do dono da loja (BACK)", item "Modificadores e
  Adicionais no Anota AI (`subItems`)"; `docs/STATUS.md` 1.4 ("Modificadores e adicionais" 🔴)
- **Arquivos:** `backend/src/modules/vendas/services/anotaai.adapter.ts` (itens e subitens),
  `backend/src/modules/vendas/services/planejar_consolidacao.ts` (`expandirItens`),
  `backend/src/modules/vendas/fixtures/anotaai/pedido_com_adicionais.json`

## Problema
Hoje todo `subItem` é tratado como produto do catálogo. No payload real, `subItems` misturam:
- **adicionais pagos** que gastam insumo ("Bacon extra", "Hambúrguer 160g");
- **observações de cozinha** sem insumo ("Sem cebola", "Ao ponto", "Molho à parte").
Uma observação que não existe no catálogo **retém a venda inteira** — com pedidos reais, isso tende a
reter quase tudo.

## Decisões do dono
1. Adicional pago vira produto com ficha técnica própria (ex.: "Bacon extra" = 30 g de bacon)? (recomendado)
2. "Sem cebola" deve **descontar a menos** do lanche ou só ser ignorado? (recomendado: ignorar no início)
3. Quem mantém a lista de observações ignoradas: tela de cadastro ou arquivo de configuração?

## Comportamento esperado (depois das decisões e das fixtures reais da tarefa 12)
- Subitem que casa com produto (por `codigoExterno` ou nome) → abate a ficha dele × quantidade do item pai.
- Subitem na lista de ignorados (normalizada, sem acento) → não abate e **não** retém.
- Subitem desconhecido → venda retida com motivo `SUBITEM_DESCONHECIDO: <nome>` (aparece na tarefa 10).

## Teste que deve falhar antes
- Fixture real com "X-Bacon" + subitem "Sem cebola" (ignorado) → venda abatida. Hoje retida.
- "X-Bacon" + "Bacon extra" (produto com ficha) → abate as duas fichas.
- Subitem desconhecido → retida com o motivo novo.

## Critério de pronto
- [ ] Fixtures reais anonimizadas no repositório; decisões do dono registradas.
- [ ] Testes falhando antes e passando depois; replay das fixtures sem retidas inesperadas.
- [ ] `docs/api.md` §5 e `docs/STATUS.md` 1.4 atualizados.
