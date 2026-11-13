# 04 — Data, saudação e "hoje" do Início não viram à meia-noite

- **Tipo:** fix · **Origem:** endurecimento F4 (PR #73), deixado fora do escopo
- **Arquivos:** `frontend/src/pages/Inicio.tsx` (linhas ~76-112), `frontend/src/lib/formatar.ts`
  (`saudacao`, `dataPorExtenso`, fuso `America/Campo_Grande`)
- **Branch sugerida:** `fix/frontend-inicio-meia-noite`

## Contexto
A loja abre à noite e fecha depois da meia-noite; o tablet/celular da cozinha fica com o Início aberto.
O Início mostra `dataPorExtenso()` (linha ~109), `saudacao()` (linha ~112) e busca
`GET /api/dashboard/resumo?periodo=hoje` uma vez, pelo `useCarregamento(buscar, [])` (linha ~83).

## Problema
Tudo é calculado no render e a busca só roda ao montar. Com a tela aberta das 23:50 às 00:10:
a data continua a de ontem, a saudação não muda de faixa enquanto nada re-renderiza, e os números
"Vendas hoje"/"Mais vendidos hoje" continuam os do dia anterior até alguém recarregar.

## Comportamento esperado
- Um timer agenda a próxima virada de dia **no fuso da loja** (`America/Campo_Grande`, não o fuso do
  aparelho) e, ao virar: atualiza data e saudação e refaz a busca de `periodo=hoje`.
- A saudação também muda nas fronteiras de faixa (manhã/tarde/noite) sem recarregar.
- O timer é limpo ao desmontar; nada roda com a aba em segundo plano além do necessário
  (opcional: recalcular em `visibilitychange` ao voltar para a aba).
- Se a busca da virada falhar, segue o tratamento de erro que o F4 já deu à tela.

## Teste que deve falhar antes
Em `frontend/src/pages/Inicio.spec.tsx`, com `vi.useFakeTimers()` e `vi.setSystemTime(...)`:
1. Monte às 23:59:30 (horário de Campo Grande) — a data na tela é a de hoje.
2. Avance 60 s. Espere a data do **dia seguinte** e uma **segunda** chamada a `/dashboard/resumo`
   com `periodo=hoje`. Hoje falha.
3. Desmonte antes da virada e avance: nenhuma chamada nova (sem vazamento de timer).
4. Rode um caso com o fuso do processo diferente do da loja (ex.: `TZ=UTC`) para provar que a virada
   segue Campo Grande.

## Critério de pronto
- [x] Testes falhando antes e passando depois (saída no PR).
- [x] Se criar helper (ex.: `msAteProximaMeiaNoiteNaLoja`) em `lib/formatar.ts`, ele tem teste
      próprio, inclusive perto da meia-noite e com fuso do aparelho diferente.
- [x] Lint, testes e build verdes.

## Fora do escopo
Relatórios (o período é escolhido pelo usuário) e qualquer mudança no backend.
