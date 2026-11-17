# 17 — Relatórios: mostrar quantos pedidos vieram do fechamento manual

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Os totais de vendas agora misturam pedidos de webhook e fechamentos manuais; o dono precisa saber quantos pedidos vieram de cada fonte (em **quantidade**; o app não mostra valores de venda, ver [20](realizadas/20-saida-em-quantidade-sem-faturamento.md))
- **Depende de:** backend [24](../backend/realizadas/24-relatorios-ocorrido-em-origem.md) (`kpis.vendasManuaisQtd`) e front [20](realizadas/20-saida-em-quantidade-sem-faturamento.md) (mesmos cartões)
- **Arquivos:** `frontend/src/pages/Dashboard.tsx` (KPIs e tipo `DadosDashboard`), `frontend/src/pages/Inicio.tsx` (cartão "Vendas hoje"), specs
- **Branch sugerida:** `feat/frontend-relatorios-vendas-manuais`

## Contexto
Depois da tarefa 24 do backend, `GET /api/dashboard/resumo` conta os fechamentos manuais (não estornados) em `totalVendasQtd`/`totalVendasValor` e informa quanto desse total veio do fechamento manual em `kpis.vendasManuaisQtd`/`vendasManuaisValor` (subconjunto, **não** somar de novo). Estornados ficam de fora de tudo.

## Problema
Sem indicação, quem olha "12 pedidos" não sabe que parte disso foi lançada à mão e pode ficar sem confiança no número (ou, ao ligar a integração, não perceber a mistura).

## Comportamento esperado
- Em **Relatórios**, no cartão de Pedidos: linha de apoio **"18 lançados no fechamento do dia"** quando `vendasManuaisQtd > 0`. Sem fechamentos manuais, a linha não aparece. **Não exibir `vendasManuaisValor`** (fechamento manual não informa preço e o valor seria sempre R$ 0).
- No **Início**, cartão "Saída de hoje": o mesmo texto curto de apoio ("inclui 3 pedidos lançados à mão") quando houver.
- Os **totais continuam os do backend**: o frontend não soma nem subtrai nada.
- Campo ausente (backend antigo) é tratado como `0` num único ponto, com teste.
- Contagem em pt-BR, sem casa decimal; tokens de design; claro/escuro; texto de apoio com contraste adequado.

## Teste que deve falhar antes
- Resposta com `vendasManuaisQtd: 18` mostra "18 lançados no fechamento do dia"; com `0` (ou campo ausente) não mostra nada. Com `vendasManuaisValor: 940` na resposta, **nenhum valor em R$ aparece**.
- O total exibido é exatamente `totalVendasQtd` (não somado com os manuais).
- Início mostra o apoio quando `vendasManuaisQtd > 0` no período `hoje`.
- Fixtures de dashboard antigas (sem os campos) continuam passando.

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) com um fechamento manual real no período; captura e **medição da cor de fundo** de cada PNG.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Novos gráficos, filtro por origem, mudanças no backend.
