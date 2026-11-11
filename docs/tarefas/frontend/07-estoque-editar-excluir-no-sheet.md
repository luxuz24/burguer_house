# 07 — Editar e excluir insumo dentro do Sheet do Estoque

- **Tipo:** feat (paridade com o esboço) · **Origem:** pendência registrada em
  `docs/PLANO_FRONTEND.md` ("Pendências depois da demonstração", item Estoque)
- **Arquivo:** `frontend/src/pages/Estoque.tsx` (Sheet de cadastro/edição em ~346-501; ícones de
  editar/excluir no card em ~696-705), `frontend/src/pages/Estoque.spec.tsx`
- **Branch sugerida:** `feat/frontend-estoque-acoes-no-sheet`

## Contexto
O esboço (`docs/design/telas.html`, Estoque) prevê que tocar no insumo abre o Sheet com os dados e as
ações **Editar** e **Excluir** lá dentro. Na migração visual (PR #68) os dois ficaram como ícones no
card para não quebrar o fluxo dos testes do F1.

## Comportamento esperado
- Tocar no card abre o Sheet do insumo; dentro dele, "Editar" (mesmo formulário de hoje) e "Excluir".
- "Excluir" usa `confirmar()` do `FeedbackContext`, trava com `useEnvio` e mostra a mensagem do
  backend em erro (insumo usado em ficha técnica: o backend responde **409** via P2003 em `error_handler.ts`; o `docs/api.md` ainda diz 500 — registre a divergência em `docs/requests.md` para o BACK, não edite o contrato).
- Ícones do card: removidos **ou** mantidos — decida pelo esboço e registre no PR. Se removidos, os
  testes do F1 que usam os ícones migram para o fluxo novo (não apague casos, adapte).
- Alvos de 44px; teclado e leitor de tela acessam as ações (nome acessível com o nome do insumo).

## Testes (escrever antes)
- Abrir o Sheet pelo card mostra "Editar" e "Excluir" do insumo certo.
- Excluir pede confirmação; cancelar não chama `DELETE`; confirmar chama uma vez só (duplo clique).
- Erro 409 do backend aparece com a mensagem dele e o Sheet continua aberto.
- Editar e salvar atualiza o card (regressão do F1).

## Critério de pronto
- [ ] Testes novos e todos os do F1 verdes; nenhum caso antigo apagado sem equivalente.
- [ ] Conferido no navegador (claro/escuro, 375px) com captura.
- [ ] Lint, testes e build verdes.

## Fora do escopo
Ajuste manual de saldo (`POST /api/insumos/:id/ajuste`) — depende de decisão do dono e do backend
(`docs/requests.md`).
