# Regras do projeto (Burguer House)

## Estrutura e donos
- backend/src/modules/<modulo>/   → agente BACK (regras e repositories)
- backend/src/infra/http/         → agente BACK (controllers, routes, app.ts)
- backend/prisma/schema.prisma e migrations → SÓ o agente de DB/testes ou o humano
- backend/tests/ e backend/prisma/seed.ts   → agente de TESTES/DB
- frontend/                       → agente FRONT
- docs/api.md é o contrato. Mudou rota? Atualize o contrato no mesmo commit.

## Git
- Trabalhe só na sua branch/worktree. Nunca commite em main.
- Conventional Commits com escopo: feat(backend):, fix(frontend):, test(db):
- Um commit por mudança lógica. Adicione arquivos por caminho, nunca `git add .`
- Antes de commitar: lint + testes da sua área devem passar.
- Faça `git rebase main` ao começar e antes de abrir o PR.
- Nunca commite .env; novas variáveis vão em .env.example.

## Técnico
- Prisma ^7 (@prisma/adapter-pg). Não atualize versões de dependências sem pedir.
- Validação de entrada com Zod nos controllers.
- Testes de banco usam DATABASE_URL_TEST (porta 5433), nunca o banco de dev.
- Registrar nova rota: crie seu arquivo *.routes.ts e adicione UMA linha em app.ts.

## Quando travar
- Precisa de mudança no schema ou em área de outro agente? Registre em
  docs/requests.md e pare. Não edite.
