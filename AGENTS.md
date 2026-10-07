# Diretrizes para Agentes de IA - Burguer House

Este documento define as regras, restrições e padrões arquiteturais obrigatórios para qualquer agente de IA que atue neste repositório.

---

## 1. Regras Fundamentais de Atuação

- **Não crie features novas sem solicitação**: Limite-se estritamente ao escopo da tarefa solicitada. Não adicione telas, rotas ou tabelas que não foram expressamente pedidas.
- **Não deixe console.log de depuração**: Nunca comite `console.log`, `console.error` ou trechos de depuração temporária. Utilize o sistema de log nativo do Fastify (`request.log.error`, `request.log.info`) no backend.
- **Git Staging Seguro**: **NUNCA** utilize `git add .` ou `git add -A`. Faça staging sempre indicando os caminhos explícitos dos arquivos (ex.: `git add backend/src/...`).
- **Padrão de Commits**: Utilize Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`). Mantenha commits atômicos (um commit por tarefa lógica).

---

## 2. Estrutura do Monorepo

```
burguer_house/
├── backend/            # API Fastify com Prisma ORM e TypeScript
├── frontend/           # Aplicação React 19 + Vite + TypeScript
├── docs/               # Documentação técnica e de rotas
├── docker-compose.yml  # Serviços de banco de dados (PostgreSQL dev e test)
└── AGENTS.md           # Diretrizes para agentes
```

- **Scripts de Desenvolvimento**:
  - `npm run dev`: Executa frontend e backend concorrentemente via `concurrently`.
  - `npm run dev:backend`: Executa o backend com `tsx watch`.
  - `npm run dev:frontend`: Executa o frontend com `vite`.

---

## 3. Padrões do Backend

- **Runtime & Módulos**: Node.js com ESM nativo (`"type": "module"`). Todos os imports relativos locais devem obrigatoriamente incluir a extensão `.js` (ex.: `import { prisma } from './prisma.js';`).
- **Framework HTTP**: Fastify.
  - CORS configurado centralmente em `backend/src/infra/http/app.ts`.
  - Rotas de domínio agrupadas em `backend/src/infra/http/routes/` com prefixo `/api/<modulo>`.
  - Controllers em `backend/src/infra/http/controllers/`.
- **Camada de Dados & Repositórios**:
  - Padrão Repository localizado em `backend/src/modules/<modulo>/repositories/`.
  - Prisma 7 com driver adapter PostgreSQL `@prisma/adapter-pg`.
  - Prisma Client gerado em `backend/generated/prisma`.
- **Tipagem**: TypeScript strict. Tipos devem ser importados explicitamente como type-only quando necessário (`import type { ... }`).

---

## 4. Padrões do Frontend

- **Tecnologias**: React 19, Vite, TypeScript.
- **Comunicação HTTP**: Axios centralizado em `frontend/src/lib/api.ts` apontando para a baseURL `/api`.
- **TypeScript**: `verbatimModuleSyntax` está ativado no `tsconfig`. Todo import de tipo/interface deve obrigatoriamente usar a sintaxe `import type { ... }` ou `import { type ... }`.
- **Estilização e Componentes**: Mantenha clareza e reutilização conforme os padrões vigentes do projeto.

---

## 5. Banco de Dados e Migrations

- **Desenvolvimento**: PostgreSQL rodando no container Docker na porta `5432` (`burguer_house`).
- **Testes**: PostgreSQL de testes dedicado rodando no container Docker na porta `5433` (`burguer_house_test`).
- **Migrations e Schema**:
  - Modificações de tabelas devem ser feitas via `prisma/schema.prisma`.
  - Migrations gerenciadas via Prisma Migrate.
  - Seeds de dados reais em `backend/prisma/seed.ts`.

---

## 6. Testes Automatizados (Vitest)

- O backend utiliza **Vitest** para testes automatizados.
- **Isolamento de Banco**: Testes que interagem com o banco de dados devem utilizar a variável de ambiente `DATABASE_URL_TEST` apontando para a porta `5433`.
- **NUNCA** execute testes destrutivos contra o banco principal na porta `5432`.
- Antes de concluir qualquer tarefa, garanta que `npm run test` no backend e `npm run build` em ambos os pacotes passem com sucesso.

---

## 7. CI/CD e Qualidade de Código

- O repositório conta com pipeline em `.github/workflows/ci.yml`.
- A pipeline valida:
  1. Validação de linting (`npm run lint`).
  2. Validação do schema do Prisma (`npx prisma validate`).
  3. Build do backend (`npm run build`).
  4. Build do frontend (`npm run build`).
  5. Execução dos testes automatizados (`npm test`).
