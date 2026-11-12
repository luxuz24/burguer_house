# 07 — Insumo sem estoque mínimo entra no alerta como crítico

- **Tipo:** fix · **Estado:** BLOQUEADA — precisa da decisão do dono: "insumo sem mínimo cadastrado deve gerar alerta?"
- **Origem:** `docs/requests.md` → "Ajustes de `GET /api/dashboard/resumo` vistos no endurecimento F4", item 3 (11/11/2026)
- **Arquivos:** `backend/src/modules/dashboard/services/dashboard.service.ts` (filtro ~345, status ~349,
  percentual ~351-353; também a contagem ~413), `dashboard.service.spec.ts`, `docs/api.md`
- **Branch sugerida:** `fix/backend-dashboard-minimo-zero`

## Problema
O filtro `estoqueAtual <= estoqueMinimo * 1.25` vale para `0 <= 0`: todo insumo com `estoqueMinimo = 0`
e estoque zerado aparece como `CRITICO`, e `percentualEstoque` vira 100 quando o mínimo é 0. Insumos
sem mínimo cadastrado inflam a contagem de alertas do Início e o "100% do mínimo" engana. O front já
mostra "Sem estoque" quando `estoqueAtual <= 0`, mas a contagem continua errada.

## Comportamento esperado (se o dono decidir "sem mínimo não alerta")
- Excluir `estoqueMinimo <= 0` do filtro **de estoque**; a regra de **validade** continua valendo para
  esses insumos.
- Mesma regra na contagem (~413) para os números do Início baterem com a lista.
- Documentar no `docs/api.md`.
Se o dono decidir o contrário ("estoque zerado sempre alerta"), mantenha o filtro e só corrija o
`percentualEstoque` (ex.: `null` quando o mínimo é 0) e documente.

## Teste que deve falhar antes
- Insumo `estoqueMinimo: 0, estoqueAtual: 0`, sem validade → **fora** de `estoqueAlerta` e da contagem.
- Mesmo insumo vencido → **dentro**, com `vencido: true`.
- Insumo `estoqueMinimo: 10, estoqueAtual: 5` → dentro, `CRITICO` (regressão).

## Critério de pronto
- [ ] Decisão do dono registrada no PR.
- [ ] Testes falhando antes e passando depois.
- [ ] Item 3 da entrada do `requests.md` marcado RESOLVIDO.
