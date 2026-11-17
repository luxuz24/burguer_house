# 30 — Cadastro e gestão de usuários pelo admin

- **Tipo:** feat · **Estado:** FEITA (#121)
- **Origem:** Decisão do dono (17/11/2026): **só ADMIN cadastra usuários**. Até aqui o único usuário era o admin do seed; sem cadastro, todos na loja dividiriam a conta e o "quem lançou" do fechamento e da entrada manual perderia o sentido.
- **Consumida por (frontend):** [22](../../frontend/realizadas/22-usuarios-tela.md)
- **Arquivos:** `backend/src/modules/auth/services/usuarios_admin.service.ts`, `backend/src/modules/auth/repositories/usuarios.repository.ts`, `backend/src/infra/http/controllers/usuarios.controller.ts`, `backend/src/infra/http/routes/usuarios.routes.ts`, `docs/api.md` (seção 10)

## O que foi feito
- `GET /api/usuarios`, `POST /api/usuarios`, `PATCH /api/usuarios/:id`, `POST /api/usuarios/:id/senha`, todas com `exigirRole('ADMIN')`.
- E-mail em minúsculas, senha bcrypt (6 caracteres a 72 bytes), papel padrão `OPERADOR`, `409` para e-mail repetido.
- Sem exclusão: desativar derruba as sessões e incrementa `tokenVersion` (reativar não revive tokens antigos). Redefinir senha também derruba as sessões.
- O admin não pode se desativar, se rebaixar nem redefinir a própria senha por estas rotas: sempre sobra um ADMIN ativo.
- Sem migration (o model `Usuario` já tinha `role`, `ativo` e `tokenVersion`).

## Testes
`backend/src/infra/http/usuarios.http.spec.ts` (9 testes, banco de teste). Mutação manual nos pontos críticos (papel, autoproteção, revogação ao desativar, e-mail em minúsculas): todas pegas.

## Fora do escopo
A matriz completa de permissões por papel nas outras rotas (tarefa [13](../13-rbac-matriz-de-permissoes.md)).
