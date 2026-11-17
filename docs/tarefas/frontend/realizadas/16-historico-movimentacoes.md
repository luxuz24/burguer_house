# 16 — Histórico de movimentações do insumo

- **Tipo:** feat · **Fase:** 4 · **Estado:** FEITA (#122)
- **Origem:** Auditoria das entradas manuais: quem deu entrada, quando e de quanto
- **Depende de:** backend [23](../../backend/realizadas/23-entrada-manual-estoque.md) (`GET /api/estoque/movimentacoes`); frontend [07](07-estoque-editar-excluir-no-sheet.md) (Sheet do insumo) e [15](15-entrada-manual-estoque-tela.md)
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (Sheet do insumo), novo componente `frontend/src/components/HistoricoMovimentacoes.tsx`, specs
- **Branch sugerida:** `feat/frontend-historico-movimentacoes`

## Contexto
Cada entrada manual grava uma `MovimentacaoEstoque` com tipo, quantidade, saldo antes e depois, custo, observação, usuário e data. Hoje nenhuma tela mostra isso.

## Problema
Sem histórico, quem confere o estoque não sabe de onde veio um aumento de saldo sem nota fiscal nem quem lançou, e não consegue reconciliar a contagem física.

## Comportamento esperado
- No Sheet do insumo (aberto pelo card, tarefa 07): seção **"Movimentações"** com as **20 mais recentes** (`GET /api/estoque/movimentacoes?insumoId=<id>&limite=20`) e botão **"Ver tudo"**.
- "Ver tudo": lista paginada (`limite=50`, botão "Carregar mais" usando `offset`) dentro do próprio Sheet ou tela dedicada, com o total (`total`).
- Cada linha: data e hora no fuso `America/Campo_Grande` (usar `lib/formatar.ts`), tipo ("Entrada manual", "Ajuste"), variação com sinal e unidade (`+24 un`), **saldo 10 → 34**, custo (R$ por unidade, quando houver), observação e nome do usuário (ou "Usuário removido" quando `usuario` for `null`).
- Estado vazio: "Nenhuma movimentação manual neste insumo." Erro de carga: mensagem + "Tentar novamente" (`useCarregamento`).
- Atualiza depois de uma entrada manual feita na [15](15-entrada-manual-estoque-tela.md).
- Tokens de design, claro/escuro, alvos de 44px nos botões.

## Teste que deve falhar antes
- O Sheet de um insumo com 2 movimentações mostra as duas, mais recente primeiro, com `saldoAnterior → saldoPosterior`, observação e usuário.
- `usuario: null` mostra "Usuário removido".
- "Carregar mais" pede `offset` seguinte e acrescenta sem duplicar; some quando todas foram carregadas.
- Vazio e erro de carga (com "Tentar novamente") renderizam como descrito.
- Datas aparecem no fuso da loja (um instante às 23:30 em MS não vira o dia seguinte).

## Critério de pronto
- [x] Testes novos verdes; `lint`, `test` e `build` verdes (41 arquivos, 721 testes; TDD: 7 falhas no RED antes da implementação).
- [x] Conferido no navegador (claro `.bg-canvas` `#fff9f3` / Sheet `#ffffff`, escuro `.bg-canvas` `#0f0f11` / Sheet `#1a1a1d`, 375×812 e 1280×800) com movimentações reais criadas pela tela "Entrada sem nota" no banco de dev (`burguer_house`); capturas e medições de pixel PNG salvas em [`evidencias-16/`](evidencias-16/).
- [x] Linha marcada `FEITA (#122)` no README e arquivo movido para `realizadas/`.

## Evidências visuais ([`evidencias-16/`](evidencias-16/))
| Captura | Viewport | Tema | Cor medida na página (`.bg-canvas`) / Sheet (`[role="dialog"]`) e pixel PNG | Status |
|---|---|---|---|---|
| [`01-historico-sheet-375-claro.png`](evidencias-16/01-historico-sheet-375-claro.png) | 375×812 | Claro | Página `#fff9f3` · Sheet `#ffffff` (`(187, 406)=#ffffff` / `(20, 20)=#a09f9e` sobre backdrop) | ✅ |
| [`02-historico-sheet-375-escuro.png`](evidencias-16/02-historico-sheet-375-escuro.png) | 375×812 | Escuro | Página `#0f0f11` · Sheet `#1a1a1d` (`(187, 406)=#1a1a1d` / `(20, 20)=#717071` sobre backdrop) | ✅ |
| [`03-historico-sheet-desktop-claro.png`](evidencias-16/03-historico-sheet-desktop-claro.png) | 1280×800 | Claro | Página `#fff9f3` · Sheet `#ffffff` (`(640, 400)=#fbf3ea` card-2 dentro do Sheet / `(20, 20)=#9a9a9b`) | ✅ |
| [`04-historico-sheet-desktop-escuro.png`](evidencias-16/04-historico-sheet-desktop-escuro.png) | 1280×800 | Escuro | Página `#0f0f11` · Sheet `#1a1a1d` (`(640, 400)=#222226` card-2 dentro do Sheet / `(20, 20)=#63656a`) | ✅ |

## Fora do escopo
Filtros por período ou tipo, exportação, histórico de baixas por venda, mudanças no backend.
