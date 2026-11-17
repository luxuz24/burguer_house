# 14 — Fechamento do dia: lançamentos do dia

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** O operador precisa saber o que já lançou e desfazer um lançamento errado
- **Depende de:** frontend [12](realizadas/12-fechamento-dia-tela-e-simulacao.md) e [13](realizadas/13-fechamento-dia-confirmacao-e-estorno.md); backend [26](../backend/26-fechamento-manual-listagem.md) (`GET /api/vendas/fechamentos-manuais`)
- **Arquivos:** `frontend/src/pages/FechamentoDia.tsx` (seção nova) ou componente `frontend/src/components/FechamentosDoDia.tsx`, specs
- **Branch sugerida:** `feat/frontend-fechamento-dia-lista`

## Contexto
Cada confirmação cria um fechamento. Num mesmo dia podem existir vários (quem lança de manhã e de noite, por exemplo), e alguns podem ter sido estornados.

## Problema
Sem uma lista, é fácil lançar o dia **duas vezes** sem perceber (repetindo todos os itens) e baixar o estoque em dobro. Também não há como achar o lançamento que precisa ser desfeito.

## Comportamento esperado
- Seção **"Lançamentos do dia"** na tela do fechamento, para a data escolhida: `GET /api/vendas/fechamentos-manuais?data=AAAA-MM-DD`. Trocar a data recarrega a lista.
- Cada lançamento mostra: horário (`criadoEm` no fuso `America/Campo_Grande`), **quem lançou** (`usuario.nome` ou "Usuário removido"), os itens ("2× BACON HOUSE · 6× Coca Cola Zero 350ml"), a observação e o estado.
- **Estornado**: selo "Estornado" com o motivo e quem estornou (`estorno.usuario.nome`, `estorno.em`); linha em estilo atenuado e **sem** botão de desfazer.
- **Não estornado**: botão **"Desfazer"** (44px) que abre o **mesmo Sheet de estorno** da [13](realizadas/13-fechamento-dia-confirmacao-e-estorno.md) (motivo obrigatório, confirmação, trava de duplo toque).
- **Aviso contra lançamento em dobro**: se já existir ao menos um lançamento **não estornado** no dia escolhido, mostrar acima do formulário: "Este dia já tem 1 fechamento (2 itens). Lançar outro soma ao anterior." (sem bloquear: pode haver dois turnos). O aviso some quando todos estão estornados.
- A lista recarrega depois de cada confirmação ou estorno (sem precisar sair da tela).
- Estado vazio: "Nenhum fechamento lançado neste dia." Erro de carga: mensagem + "Tentar novamente" (`useCarregamento`).
- Tokens de design, claro/escuro, 375px sem rolagem horizontal.

## Teste que deve falhar antes
- Lista dois lançamentos (um estornado) com autor, itens, observação e selo; o estornado não tem botão "Desfazer".
- Trocar a data chama a rota com a nova data; vazio e erro de carga renderizam como descrito.
- Aviso de "já tem fechamento" aparece com um lançamento ativo e some quando todos estão estornados.
- "Desfazer" abre o Sheet de estorno e, ao concluir, a lista é recarregada mostrando "Estornado".
- Depois de confirmar uma baixa na [13](realizadas/13-fechamento-dia-confirmacao-e-estorno.md), o novo lançamento aparece sem recarregar a página.
- `usuario: null` mostra "Usuário removido".

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) com vários lançamentos reais, um estornado; captura e **medição da cor de fundo** de cada PNG.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Edição de lançamento, paginação, relatório por período (os totais aparecem em [17](17-relatorios-vendas-manuais.md)), mudanças no backend.
