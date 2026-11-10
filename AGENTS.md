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

## Plano do projeto
- O escopo e os critérios de "pronto" de cada fase estão em docs/PLANO.md.
- Leia só a fase em que você está trabalhando, não o arquivo inteiro.
- O PLANO.md diz O QUE construir. O código e o docs/api.md dizem o que JÁ existe.
  Se os dois divergirem, não decida sozinho: registre em docs/requests.md e pare.

## Grafo do código (graphify)
- `graphify-out/` é local (não versionado) e se atualiza sozinho pelos ganchos do git
  (commit, checkout, merge, rebase). Depois de um merge feito no GitHub, rode `git pull`.
- Antes de mudar uma função, hook ou componente compartilhado, veja quem depende dele:
  `graphify affected "nomeDaFuncao()"` (lista quem chama e importa, com arquivo:linha).
- Para entender uma área: `graphify query "<pergunta>" --budget 1500`;
  `graphify explain "<nó>"`; `graphify path "A" "B"`.
- O grafo aponta onde olhar; a decisão vem da leitura do código e dos testes.
- Se `graphify-out/` não existir ou o "Built from commit" do `GRAPH_REPORT.md` estiver
  atrás do HEAD, rode `graphify update .` (sem custo de API).
