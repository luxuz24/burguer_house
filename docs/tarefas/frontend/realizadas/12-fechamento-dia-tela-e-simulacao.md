# 12 — Fechamento do dia: tela e simulação do impacto

- **Tipo:** feat · **Fase:** 4 · **Estado:** FEITA (#109)
- **Origem:** Pedido da hamburgueria: enquanto não há integração com a Anota AI, a pessoa informa o que saiu no dia e o estoque dá baixa
- **Depende de:** backend [22](../../backend/realizadas/22-fechamento-manual-dia.md) (`POST /api/vendas/fechamento-manual/simulacao`); `GET /api/produtos`
- **Arquivos:** `frontend/src/App.tsx` (`modalAberto`), `frontend/src/pages/Inicio.tsx` (atalho), novo `frontend/src/pages/FechamentoDia.tsx`, `FechamentoDia.spec.tsx`, `Inicio.spec.tsx`, `App.spec.tsx`
- **Branch sugerida:** `feat/frontend-fechamento-dia-simulacao`

## Contexto
O fechamento manual baixa o estoque pelas fichas técnicas dos produtos vendidos (embalagens e bebidas já entram nas fichas). O backend oferece uma **simulação sem efeito** que devolve, por insumo, quanto vai sair, o estoque atual e o projetado, e avisa de produto sem ficha. Esta tarefa entrega a tela de lançamento e a **pré-visualização**; a confirmação é a [13](13-fechamento-dia-confirmacao-e-estorno.md).

## Problema
Sem a tela, o operador não consegue informar o que vendeu. E lançar às cegas é arriscado: ele precisa ver, antes de baixar, quais insumos vão ficar negativos ou quais produtos estão sem ficha.

## Comportamento esperado
- **Entrada**: card de atalho **"Fechar o dia"** no Início (abaixo das ações atuais; 44px). Abre `FechamentoDia` em **tela cheia**, com seta de voltar, no mesmo padrão do `ImportarNotaFiscal` (acrescentar `'fechamentoDia'` ao `modalAberto` do `App`). Como o `App` reinicia o estado quando a sessão cai (tarefa 03), a tela some junto.
- **Dia das vendas**: campo de data, padrão **hoje no fuso da loja** (`dataHojeNaLoja()`), `max` = hoje (sem data futura). Rótulo "Dia das vendas".
- **Produtos**: `GET /api/produtos`, busca por nome e uma linha por produto com nome, **− / +** (alvo de 44px) e campo numérico (`inputMode="numeric"`, inteiro, 0 a 500). Produto com quantidade `> 0` fica destacado.
  - Se `GET /api/produtos` não distinguir produto vendável de produto interno (ex.: "PRODUÇÃO: Maionese da Casa"), registrar em `docs/requests.md` e, enquanto isso, ocultar nomes que começam com `PRODUÇÃO:` em **um único helper isolado e testado** (não espalhar essa regra).
- **Resumo fixo** no rodapé: "N produtos · M unidades" e botão **"Ver impacto no estoque"**, desabilitado enquanto nada tem quantidade `> 0`.
- **Impacto** (`POST .../simulacao` só com os itens `> 0` e a `data`): mostra, agrupado por categoria (Ingredientes, Embalagens, Bebidas), cada insumo com **"consumo"**, **"estoque atual → projetado"** (com `formatarQuantidade` e a unidade). Insumos que **ficariam negativos** vêm primeiro, em destaque (cor de alerta + texto "ficaria negativo", não só a cor).
- `produtosSemFicha` aparece como bloco de aviso: "Estes produtos não têm ficha técnica e impedem a baixa: X-Tudo." (`podeConfirmar: false`).
- **Invalidação**: qualquer mudança em quantidade, produto ou data torna o impacto exibido obsoleto ("Atualize o impacto") e desabilita a confirmação da [13](13-fechamento-dia-confirmacao-e-estorno.md) até nova simulação.
- Carga de produtos com `useCarregamento` (erro com mensagem do backend e "Tentar novamente"); a simulação trava com `useEnvio` e mostra a mensagem do backend em erro (`422`, `400`).
- Tokens de design (sem cores literais), claro/escuro, sem rolagem horizontal em 375px.

## Teste que deve falhar antes
- O atalho do Início abre a tela cheia; voltar volta ao shell; sessão que cai fecha a tela.
- Produtos listados e buscáveis; `+`/`−` e digitação mudam a quantidade (limites 0 e 500); data futura não é aceita.
- "Ver impacto" fica desabilitado sem itens e, com itens, chama a simulação **só com os itens de quantidade `> 0`** e a `data`.
- Resposta com insumo negativo mostra o aviso e o coloca primeiro; `podeConfirmar: false` mostra os produtos sem ficha.
- Mudar a quantidade depois da simulação marca o impacto como obsoleto.
- Erro `422`/`400` do backend aparece com a mensagem dele; erro ao carregar produtos mostra "Tentar novamente".
- O helper que oculta `PRODUÇÃO:` tem teste próprio.

## Critério de pronto
- [x] Testes novos verdes e nenhum antigo quebrado; `lint`, `test` e `build` verdes.
- [x] Conferido no navegador em 375px, claro e escuro, com produtos com e sem ficha e insumo que fica negativo (API local de teste, sem banco real): sem rolagem horizontal, nenhum alvo de toque abaixo de 44px, fundo medido `rgb(255, 249, 243)` (claro) e `rgb(15, 15, 17)` (escuro). **Desktop não conferido.**
- [x] Linha marcada `FEITA (#109)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Confirmar a baixa e estornar ([13](13-fechamento-dia-confirmacao-e-estorno.md)), lista do dia ([14](14-fechamento-dia-lista-do-dia.md)), mudanças no backend.
