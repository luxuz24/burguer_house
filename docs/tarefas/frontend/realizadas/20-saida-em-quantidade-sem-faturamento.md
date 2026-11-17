# 20 — Mostrar a saída em quantidade e esconder o faturamento (R$ de vendas)

- **Tipo:** feat (ajuste de escopo) · **Fase:** 4 · **Estado:** FEITA (#115)
- **Origem:** Decisão do dono: o app é de **estoque**, não de finanças. O que interessa é quanto saiu, não quanto a venda rendeu
- **Depende de:** — (usa só o que o backend já entrega em `GET /api/dashboard/resumo`; **nenhuma mudança no backend**)
- **Arquivos:** `frontend/src/pages/Inicio.tsx` (cartão escuro "Vendas hoje", ~linha 200-210), `frontend/src/pages/Dashboard.tsx` (KPI "Vendas", ~linha 336, e a lista de itens mais vendidos), `frontend/src/pages/Inicio.spec.tsx`, `frontend/src/pages/Dashboard.spec.tsx`, `frontend/src/test/fixtures/dashboard.fixture.ts`
- **Branch sugerida:** `feat/frontend-saida-em-quantidade`

## Contexto
O dashboard mostra hoje "Vendas R$ 12.450,00" (`kpis.totalVendasValor`) e valores em reais nos itens mais vendidos (`valorEstimadoTotal`). Esses valores vêm dos pedidos da Anota AI e, nos fechamentos manuais do dia, **são sempre zero** (o fechamento não informa preço). O resultado é um número que parece faturamento e não é confiável. A hamburgueria não quer finanças no app; quer saber **o que saiu** do estoque.

## Problema
Um cartão de dinheiro puxa o app para o lado financeiro e engana quando há fechamento manual. O cartão "Vendas hoje" do Início é o bloco de maior destaque da tela e mostra justamente esse valor.

## Comportamento esperado
- **Início, cartão escuro "Vendas hoje":** passa a se chamar **"Saída de hoje"**. O número grande vira a **quantidade de pedidos** (`kpis.totalVendasQtd`, "12 pedidos"); sai o valor em R$. O texto de apoio mostra a quantidade de itens que saíram (soma de `itensMaisVendidos[].quantidadeVendida`) **só quando a lista tem menos de 10 produtos**: o backend devolve no máximo 10, e com 10 ou mais a soma poderia ficar menor que a real, então o total não é exibido.
- **Relatórios, KPI "Vendas":** vira **"Pedidos"** (`totalVendasQtd`), sem R$. Os outros KPIs (Compras, Perdas, Em alerta) **ficam como estão**.
- **Itens mais vendidos:** mostrar só nome e **quantidade**; sem `valorEstimadoTotal` (as duas telas já mostravam só a quantidade; o teste protege isso).
- **Consumo de insumos:** manter a quantidade e o custo estimado por insumo (`valorEstimado`): é custo do estoque, útil para a loja, e **não** é faturamento.
- Não remover nada do tipo `DadosDashboard`: os campos de valor continuam existindo no contrato, só **não são exibidos**. O backend não muda.
- Pt-BR, tokens de design, claro e escuro, sem rolagem horizontal em 375px; alvos de toque de 44px onde houver ação.

## Teste que deve falhar antes
- `Inicio.spec.tsx`: com `totalVendasValor: 12450` e `totalVendasQtd: 12`, o cartão mostra "12 pedidos" e **não** contém "R$ 12.450,00" nem o rótulo "Vendas hoje".
- `Dashboard.spec.tsx`: o KPI mostra "Pedidos" com a contagem e **não** mostra o valor de vendas em R$; Compras, Perdas e Em alerta continuam com seus valores.
- Itens mais vendidos: aparece a quantidade e **não** aparece valor em R$.
- Fixtures antigas (com os campos de valor) continuam passando; os campos ausentes não quebram a tela.
- Regressão: os testes atuais de Início e Relatórios continuam verdes (adaptar, não apagar sem equivalente).

## Critério de pronto
- [x] Testes novos verdes; `npm --prefix frontend run lint`, `test` e `build` verdes.
- [x] Conferido no navegador a 375px, claro e escuro, com uma API local de teste (sem banco real) que devolve `totalVendasValor: 12450`: o Início mostra "Saída de hoje · 61 itens · 48 pedidos" e o Relatórios "Pedidos · 48", sem nenhum R$ de venda; "Mais vendidos" só em quantidade; custo do consumo, Compras e Perdas mantidos. Sem rolagem horizontal; fundo medido `rgb(255, 249, 243)` (claro) e `rgb(15, 15, 17)` (escuro). **Não conferido: desktop, banco real e capturas anexadas.**
- [x] Linha marcada `FEITA (#115)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Remover campos de valor do backend ou do contrato, novo endpoint "saída do dia" (se for necessário, abrir tarefa de backend à parte), preço no cadastro de produto, valor do caixa no fechamento manual.
