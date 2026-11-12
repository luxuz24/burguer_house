# 06 — Top 10 de consumo ordenado por quantidade, somando unidades diferentes

- **Tipo:** fix · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "Ajustes de `GET /api/dashboard/resumo` vistos no endurecimento F4", item 2 (11/11/2026)
- **Arquivos:** `backend/src/modules/dashboard/services/dashboard.service.ts` (`consumoInsumos`, ~330-339),
  `dashboard.service.spec.ts`, `docs/api.md`
- **Branch sugerida:** `fix/backend-dashboard-consumo-top10`

## Problema
`consumoInsumos` é ordenado por `quantidadeConsumida` e cortado em 10
(`.sort((a, b) => b.quantidadeConsumida - a.quantidadeConsumida).slice(0, 10)`). Comparar 48.000 g
com 300 unidades não diz nada. A seção da tela é "O que a cozinha mais consumiu — custo estimado" e
reordena por `valorEstimado`, mas só enxerga os 10 de maior **quantidade**: um insumo caro consumido
em poucas unidades fica de fora.

## Comportamento esperado
- Ordenar por `valorEstimado` desc **antes** do `slice(0, 10)`; empate → `quantidadeConsumida` desc →
  `nome` (ordem estável e testável).
- Insumo com `custoUnitario` 0/nulo (valor 0) só entra se sobrar vaga — documente.
- Contrato: dizer no `docs/api.md` que é o top 10 por custo estimado.

## Teste que deve falhar antes
- 11 insumos: 10 em gramas com quantidades grandes e valor baixo, 1 em unidade com quantidade 2 e valor
  alto → o caro **aparece** na lista. Hoje fica de fora.
- Empate de valor → desempate por quantidade (regressão de ordem estável).

## Critério de pronto
- [ ] Teste falhando antes (saída no PR) e passando depois.
- [ ] `docs/api.md` atualizado com o critério.
- [ ] Item 2 da entrada do `requests.md` marcado RESOLVIDO.

## Fora do escopo
Parâmetro de ordenação na rota (só se o dono pedir) e `itensMaisVendidos` (ordem por quantidade de
produto faz sentido: mesma unidade).
