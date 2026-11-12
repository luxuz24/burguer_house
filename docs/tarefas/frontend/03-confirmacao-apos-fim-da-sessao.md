# 03 — Diálogo de confirmação continua aberto depois que a sessão acaba

- **Tipo:** fix · **Origem:** endurecimento F5 (PR #72), achado registrado
- **Arquivos:** `frontend/src/context/FeedbackContext.tsx`, `frontend/src/App.tsx`,
  `frontend/src/context/AuthContext.tsx` (só leitura, se possível)
- **Branch sugerida:** `fix/frontend-confirmacao-fim-sessao`

## Contexto
O F5 colocou as confirmações em fila e as resolve com `false` quando o **provider** desmonta
(`FeedbackContext.tsx:~112-123`). Mas a ordem em `App.tsx:101-103` é
`ThemeProvider > FeedbackProvider > AuthProvider`: o `FeedbackProvider` fica **acima** da sessão e não
desmonta no logout. O F5 também fez o shell (`ShellAutenticado`) começar do zero a cada sessão.

## Problema
Um `confirmar()` aberto (ex.: "Excluir insumo?") e a sessão caindo (401 do interceptor, logout em
outra aba, token revogado pela troca de senha) deixam o diálogo **por cima da tela de Login**. Se o
usuário clicar em "Confirmar", a promise resolve `true` para uma tela que já não existe; se outro
usuário logar em seguida, o diálogo da sessão anterior ainda está na fila.

## Comportamento esperado
- Quando a sessão termina (usuário passa de logado para deslogado), todas as confirmações pendentes
  resolvem com `false` e somem da tela. Os toasts podem ficar (mensagens como "Sessão expirada" devem
  continuar visíveis).
- A API pública do `FeedbackContext` (`toast`, `confirmar`) **não muda** — Início, Relatórios,
  Estoque, Fichas, Preparo, Perdas e Nota Fiscal usam. Rode `graphify affected "useFeedback()"` antes.
- Opções aceitáveis (escolha e justifique no PR): uma função interna `cancelarConfirmacoes()` exposta
  só para o App, chamada quando a sessão cai; ou o `ShellAutenticado` envolver as confirmações num
  provider próprio. Hoje o `AuthContext` não usa `useFeedback`, então mover o `FeedbackProvider` para dentro do `AuthProvider` é possível — mas confira que nenhum toast de "sessão expirada" depende da ordem atual.

## Teste que deve falhar antes
Em `frontend/src/App.spec.tsx` (já passa pelos interceptors reais com adapter falso):
1. Logado, abra uma tela que chama `confirmar()` (ou dispare um `confirmar()` por um componente de teste).
2. Com o diálogo aberto, faça uma requisição responder 401 (ou chame `logout`).
3. Espere: tela de Login visível, o `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`, montado pelo `FeedbackContext`) **fora** da tela, e a
   promise resolvida com `false`. Hoje o diálogo fica.
4. Novo login: nenhum diálogo da sessão anterior aparece.

## Critério de pronto
- [x] Teste falhando antes e passando depois (saída no PR).
- [x] Testes existentes do `FeedbackContext.spec.tsx` (fila, desmonte, duplo clique) seguem verdes.
- [x] Lint, testes e build verdes.

## Fora do escopo
Mudar a aparência do diálogo ou dos toasts.
