# 22 — Tela de usuários (só para o admin)

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Decisão do dono (17/11/2026): só ADMIN cadastra usuários. Sem a tela, cada funcionário teria de usar a conta do admin
- **Depende de:** backend [30](../backend/realizadas/30-usuarios-cadastro-admin.md) (`/api/usuarios`, contrato em `docs/api.md`, seção 10)
- **Arquivos:** `frontend/src/pages/Configuracoes.tsx` (entrada "Usuários", só para ADMIN), novo `frontend/src/pages/Usuarios.tsx`, specs
- **Branch sugerida:** `feat/frontend-usuarios`

## Contexto
O backend expõe listar, criar, alterar (nome, telefone, papel, ativo) e redefinir a senha de outro usuário, tudo só para `ADMIN`. Não há exclusão: tira-se o acesso desativando. O admin não pode se desativar, se rebaixar nem redefinir a própria senha por essas rotas (`400`); a própria senha continua no Perfil (`PUT /api/auth/senha`).

## Comportamento esperado
- Em **Configurações**, item **"Usuários"** (44px) visível **só para ADMIN** (papel do `AuthContext`). Para os outros papéis o item não aparece.
- Lista com nome, e-mail, papel ("Administrador", "Gerente", "Operador") e situação ("Ativo"/"Inativo", com inativos esmaecidos e no fim). O usuário logado aparece marcado "(você)".
- **"Novo usuário"**: Sheet com nome, e-mail, telefone (opcional), papel (rádio de 3 opções, padrão Operador) e senha inicial (mín. 6, com mostrar/ocultar). Validação junto do campo; `409` mostra "Já existe um usuário com este e-mail."; `useEnvio` contra duplo toque. Sucesso fecha o Sheet, recarrega a lista e mostra `toast`.
- Tocar num usuário abre o Sheet de edição: nome, telefone, papel e um botão **"Desativar acesso"** / **"Reativar acesso"** com `confirmar()` ("Ana não vai mais conseguir entrar e será desconectada agora."). Envia só o que mudou (`PATCH`).
- **"Redefinir senha"** no Sheet: campo da nova senha + confirmação; `204` mostra "Senha redefinida. Ana precisa entrar de novo com a senha nova."
- Para **a própria conta**: papel e "Desativar" desabilitados com a explicação "Você não pode alterar o seu próprio papel nem desativar a sua conta"; "Redefinir senha" leva ao Perfil.
- `403` (o papel do usuário mudou no meio do caminho) mostra "Só o administrador pode gerenciar usuários." e volta para Configurações.
- Tokens de design, claro/escuro, alvos de 44px.

## Teste que deve falhar antes
- OPERADOR e GERENTE não veem "Usuários" em Configurações; ADMIN vê e abre a lista.
- Criar envia `POST /usuarios` com o papel escolhido; `409` mostra a mensagem e mantém o Sheet com os dados; duplo toque faz uma chamada.
- Desativar pede confirmação e envia `PATCH { ativo: false }`; a lista mostra "Inativo".
- Na própria conta, papel e desativar ficam desabilitados.
- Redefinir senha envia `POST /usuarios/:id/senha`; senha curta não envia.

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px), logado como ADMIN, criando e desativando um usuário de teste pela própria tela (não por SQL); captura e medição da cor de fundo.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Excluir usuário, matriz de permissões das outras telas (tarefa back 13), convite por e-mail, recuperação de senha sem o admin.
