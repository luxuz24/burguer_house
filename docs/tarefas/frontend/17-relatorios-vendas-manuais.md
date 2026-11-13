# 17 — Relatórios: mostrar vendas lançadas no fechamento manual

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Os totais de vendas agora misturam pedidos de webhook e fechamentos manuais; o dono precisa saber quanto veio de cada fonte
- **Depende de:** backend [24](../backend/24-relatorios-ocorrido-em-origem.md) (`kpis.vendasManuaisQtd` e `kpis.vendasManuaisValor`)
- **Arquivos:** `frontend/src/pages/Dashboard.tsx` (KPIs e tipo `DadosDashboard`), `frontend/src/pages/Inicio.tsx` (cartão "Vendas hoje"), specs
- **Branch sugerida:** `feat/frontend-relatorios-vendas-manuais`

## Contexto
Depois da tarefa 24 do backend, `GET /api/dashboard/resumo` conta os fechamentos manuais (não estornados) em `totalVendasQtd`/`totalVendasValor` e informa quanto desse total veio do fechamento manual em `kpis.vendasManuaisQtd`/`vendasManuaisValor` (subconjunto, **não** somar de novo). Estornados ficam de fora de tudo.

## Problema
Sem indicação, quem olha "Vendas R$ 12.450" não sabe que parte disso foi lançada à mão e pode ficar sem confiança no número (ou, ao ligar a integração, não perceber a mistura).

## Comportamento esperado
- Em **Relatórios**, no cartão de Vendas: linha de apoio **"R$ 940,00 (18) lançados no fechamento do dia"** quando `vendasManuaisQtd > 0`. Sem fechamentos manuais, a linha não aparece.
- No **Início**, cartão "Vendas hoje": o mesmo texto curto de apoio ("inclui 3 pedidos lançados à mão") quando houver.
- Os **totais continuam os do backend**: o frontend não soma nem subtrai nada.
- Campo ausente (backend antigo) é tratado como `0` num único ponto, com teste.
- Valores em pt-BR (`formatarMoeda`, contagem sem casa decimal); tokens de design; claro/escuro; texto de apoio com contraste adequado.

## Teste que deve falhar antes
- Resposta com `vendasManuaisQtd: 18` e `vendasManuaisValor: 940` mostra a linha com os valores formatados; com `0` (ou campo ausente) não mostra nada.
- Os totais exibidos são exatamente `totalVendasValor`/`totalVendasQtd` (não somados com os manuais).
- Início mostra o apoio quando `vendasManuaisQtd > 0` no período `hoje`.
- Fixtures de dashboard antigas (sem os campos) continuam passando.

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) com um fechamento manual real no período; captura e **medição da cor de fundo** de cada PNG.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Novos gráficos, filtro por origem, mudanças no backend.
