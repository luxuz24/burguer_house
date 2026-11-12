# 01 — `fatorPerda` negativo reduz o consumo na produção interna

- **Tipo:** fix · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "[Backend / Produção] Normalização de fatorPerda Negativo em producao.service.ts" (10/11/2026)
- **Arquivos:** `backend/src/modules/preparo_interno/services/producao.service.ts` (~linha 41),
  `backend/src/modules/preparo_interno/services/producao.service.spec.ts`
- **Branch sugerida:** `fix/backend-fatorperda-producao`

## Contexto
O consumo de um insumo bruto é `quantidade × (1 + fatorPerda)`. A consolidação de vendas já protege o
fator: `planejar_consolidacao.ts:197` usa `Math.max(0, ficha.insumo.fatorPerda || 0)`.

## Problema
`producao.service.ts:41` usa o valor cru:
`consumo = quantidadeNecessaria * (1 + ing.insumoBruto.fatorPerda) * quantidade`.
Um insumo com `fatorPerda = -0.05` (erro de cadastro, migração ou seed) faz a produção baixar **menos**
do que foi gasto: o estoque do bruto fica maior que o real e a checagem de "estoque insuficiente"
(`:44`) libera produção que não deveria. `fatorPerda` `null`/`NaN` vira `NaN` no consumo.

## Comportamento esperado
- Mesma regra da consolidação: `const fatorPerda = Math.max(0, ing.insumoBruto.fatorPerda || 0)`.
  Ideal: extrair um helper único (ex.: `fatorPerdaSeguro(valor)` em `backend/src/shared/`) usado pelos
  dois serviços, para a regra não divergir de novo. Rode `graphify affected` antes de mexer no planejador.
- Arredondamento `toFixed(4)` mantido.

## Teste que deve falhar antes
Em `producao.service.spec.ts`:
1. Sub-ficha com 100 g de um bruto com `fatorPerda: -0.05`; produzir 1 → esperar consumo **100**
   (hoje 95).
2. Bruto com estoque 96 e o mesmo fator → esperar **409 estoque insuficiente** (hoje passa).
3. `fatorPerda: 0.1` continua consumindo 110 (regressão).

## Critério de pronto
- [ ] Testes falhando antes (saída no PR) e passando depois.
- [ ] Se extraiu helper, a consolidação usa o mesmo e seus testes seguem verdes.
- [ ] Mutação do `producao.service.ts` ≥ 85%.
- [ ] Entrada do `requests.md` marcada RESOLVIDO.

## Fora do escopo
Bloquear `fatorPerda < 0` na validação do cadastro de insumo — pode virar tarefa nova (o Zod de
`insumos.controller.ts` decide), mas não misture neste PR.
