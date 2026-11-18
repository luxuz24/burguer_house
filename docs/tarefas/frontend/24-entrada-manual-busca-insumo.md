# 24 — Busca de insumo visível e funcional na Entrada manual

- **Tipo:** fix · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Conferência no celular real da [tarefa 18](realizadas/18-conferencia-visual-fase4.md) (17/11/2026)
- **Arquivos:** `frontend/src/pages/EntradaManual.tsx` (linhas 396-517: busca, filtro por categoria e `<select>` de cada item), `frontend/src/pages/EntradaManual.spec.tsx`
- **Branch sugerida:** `fix/frontend-entrada-manual-busca-insumo`

## Contexto
Cada item da Entrada manual tem um campo **"Buscar insumo por nome..."** (linha 482), os atalhos de categoria e um `<select>` fechado logo abaixo (linha 492). A busca só filtra as `<option>` desse `<select>`; a linha 398 (`if (ins.id === linha.insumoId) return true`) mantém o insumo já escolhido na lista mesmo quando ele não bate com a busca.

## Problema
No celular, digitar na busca **não muda nada na tela**: o `<select>` continua mostrando "Selecione um insumo..." ou o insumo antigo, e o usuário não sabe se a busca achou algo. Para trocar de insumo depois de escolher um, a busca também não ajuda.

## Comportamento esperado
- Com termo digitado (ou categoria filtrada), aparece **logo abaixo da busca** uma lista de resultados tocáveis (alvos de 44px) com nome e unidade, e o contador "N encontrados".
- Sem resultado: mensagem **"Nenhum insumo encontrado"**.
- Tocar num resultado seleciona o insumo **naquela linha**, inclusive **substituindo** um insumo já escolhido; a busca é limpa e a lista some.
- Insumo já usado em outra linha aparece desabilitado na lista (mesma regra do `<select>`, que continua existindo para quem preferir).
- Ao trocar o insumo, a unidade de digitação volta para a base (como já acontece hoje no `<select>`).
- Rode `graphify affected` em `EntradaManual.tsx` antes de mexer; reaproveite `normalizarBusca` e o filtro por categoria que já existem (sem duplicar).

## Teste que deve falhar antes
- Digitar "carne" mostra a lista com os insumos que batem e o contador; tocar em um seleciona na linha (o `<select>` passa a ter esse valor) e a lista some.
- Termo sem correspondência mostra "Nenhum insumo encontrado".
- Com um insumo escolhido, buscar outro nome e tocar no resultado substitui o insumo da linha.
- Insumo usado em outra linha aparece desabilitado e não é selecionável pela lista.
- Filtro de categoria sem termo também mostra a lista filtrada.

## Critério de pronto
- [ ] Testes novos verdes (com a contagem de falhas antes); `lint`, `test` e `build` verdes.
- [ ] Conferido **no celular real**: buscar, tocar no resultado, trocar o insumo de uma linha já preenchida.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Busca no backend, mudar a Contagem (que já lista os insumos direto na tela), mudanças no backend.
