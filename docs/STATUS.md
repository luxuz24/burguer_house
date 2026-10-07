# Status de Execução do Projeto — Burguer House

Este documento compara o planejamento definido em [docs/PLANO.md](file:///mnt/Projetos/burguer_house/docs/PLANO.md) com o estado real implementado no repositório.

**Legenda:**
-  **Feito**: Totalmente implementado e comprovado no código.
- 🟡 **Parcial**: Iniciado ou implementado com limitações/diferenças em relação ao plano.
- 🔴 **Pendente**: Não iniciado ou sem arquivos correspondentes no repositório.

---

## 1. Tabela de Status por Fase

### Fase 0 — Setup do ambiente de desenvolvimento

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Instalar Node.js 24 LTS |  Feito | [package.json](file:///mnt/Projetos/burguer_house/package.json), [.github/workflows/ci.yml](file:///mnt/Projetos/burguer_house/.github/workflows/ci.yml) | Ambiente local operando com Node v26 / CI configurado com Node v22. |
| Monorepo com `/backend` e `/frontend` |  Feito | [package.json](file:///mnt/Projetos/burguer_house/package.json) | Estrutura monorepo com scripts concorrentes (`concurrently`). |
| PostgreSQL 18 local via Docker Compose |  Feito | [docker-compose.yml](file:///mnt/Projetos/burguer_house/docker-compose.yml) | Postgres dev na porta 5432 (`postgres_18_db`) e Postgres test na porta 5433 (`postgres_test_db`). |
| Backend com Fastify `^5.8` e Prisma `^7` |  Feito | [backend/package.json](file:///mnt/Projetos/burguer_house/backend/package.json) | Fastify `^5.12.5`, Prisma `^7.10.0` e `@prisma/client` `^7.10.0`. |
| `npx prisma init` e `DATABASE_URL` local |  Feito | [backend/prisma/schema.prisma](file:///mnt/Projetos/burguer_house/backend/prisma/schema.prisma), [backend/prisma7.config.ts](file:///mnt/Projetos/burguer_house/backend/prisma7.config.ts) | Banco configurado via adapter PostgreSQL. |
| Frontend com React 19.2 + Vite + Tailwind | 🟡 Parcial | [frontend/package.json](file:///mnt/Projetos/burguer_house/frontend/package.json) | React 19.2 e Vite configurados. **Tailwind CSS não foi instalado**; utiliza CSS inline e App.css. |
| Criar contas gratuitas (Neon, Koyeb, Vercel) | 🔴 Pendente | N/A (externo) | Sem configurações ou integrações de deploy no repositório. |
| `.env.example` documentado |  Feito | [.env.example](file:///mnt/Projetos/burguer_house/.env.example), [backend/.env.example](file:///mnt/Projetos/burguer_house/backend/.env.example) | Variáveis de desenvolvimento, teste e Docker documentadas. |
| Criar conta no cron externo | 🔴 Pendente | N/A (externo) | Sem crons externos ativos ou configurados. |

---

### Fase 1 — Fundação (banco de dados + API base)

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Modelagem Prisma (`Insumo`, `Produto`, `FichaTecnica`, `Venda`) |  Feito | [backend/prisma/schema.prisma](file:///mnt/Projetos/burguer_house/backend/prisma/schema.prisma) | Todas as entidades modeladas. **Campos em camelCase** (`fatorPerda`, `estoqueAtual`, `estoqueMinimo`) diferem do snake_case do plano. |
| Migration inicial (`init`) |  Feito | [backend/prisma/migrations/20260930023003_init/migration.sql](file:///mnt/Projetos/burguer_house/backend/prisma/migrations/20260930023003_init/migration.sql) | Migration gerada e aplicada com sucesso. |
| Seed com dados iniciais |  Feito | [backend/prisma/seed.ts](file:///mnt/Projetos/burguer_house/backend/prisma/seed.ts) | Superou o plano: inseriu **49 insumos reais** e fichas técnicas de 7 produtos em vez de dados fictícios. |
| Endpoint `GET /health` |  Feito | [backend/src/infra/http/routes/health.routes.ts](file:///mnt/Projetos/burguer_house/backend/src/infra/http/routes/health.routes.ts) | Healthcheck ativo e documentado em [docs/api.md](file:///mnt/Projetos/burguer_house/docs/api.md). |
| CI básico (GitHub Actions) |  Feito | [.github/workflows/ci.yml](file:///mnt/Projetos/burguer_house/.github/workflows/ci.yml) | Executa lint, prisma validate, prisma generate, build e testes automatizados. |
| Deploy inicial (Koyeb + Neon) | 🔴 Pendente | N/A (externo) | Não há automação ou deploy ativo para ambientes em nuvem. |

---

### Fase 2 — Insumos, almoxarifado e fichas técnicas

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| CRUD de insumos (backend) |  Feito | [backend/src/modules/insumos/repositories/insumos.repository.ts](file:///mnt/Projetos/burguer_house/backend/src/modules/insumos/repositories/insumos.repository.ts), [backend/src/infra/http/controllers/insumos.controller.ts](file:///mnt/Projetos/burguer_house/backend/src/infra/http/controllers/insumos.controller.ts) | Endpoints `POST`, `GET`, `PUT`, `DELETE` implementados e testados. |
| Tela de cadastro de Ficha Técnica multi-nível | 🔴 Pendente | Inexistente | Modelada apenas no banco; sem controllers, rotas ou interface. |
| Lógica e endpoint de estoque mínimo |  Feito | [backend/src/modules/insumos/repositories/insumos.repository.ts](file:///mnt/Projetos/burguer_house/backend/src/modules/insumos/repositories/insumos.repository.ts), [backend/src/infra/http/routes/insumos.routes.ts](file:///mnt/Projetos/burguer_house/backend/src/infra/http/routes/insumos.routes.ts) | Método `listarAlertas()` e rota `GET /api/insumos/alertas`. |
| Tela React mobile-first para insumos e alertas | 🟡 Parcial | [frontend/src/App.tsx](file:///mnt/Projetos/burguer_house/frontend/src/App.tsx) | Interface funcional com listagem, alerta visual (vermelho + "⚠️ Comprar"), criação, edição e exclusão. **Construída em tabela HTML**, sem Tailwind e sem layout mobile-first em cards. |
| Teste manual de consumo com fator de perda | 🔴 Pendente | Inexistente | Fichas técnicas e baixas por fator de perda ainda não operam via aplicação. |

---

### Fase 3 — Ingestão de vendas (webhook) e consolidação de estoque

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Endpoint `POST /webhook/anota-ai` (fire-and-forget) | 🔴 Pendente | Inexistente | Tabela `Venda` com JSONB existe no schema, mas nenhuma rota ou controller foi criado. |
| Validação de payload da Anota AI | 🔴 Pendente | Inexistente | Não implementado. |
| Log assíncrono de erros de webhook | 🔴 Pendente | Inexistente | Não implementado. |
| Rotina de consolidação (`POST /consolidar`) | 🔴 Pendente | Inexistente | Não implementado. |
| Tratamento de modificadores/adicionais | 🔴 Pendente | Inexistente | Não implementado. |
| Idempotência na consolidação | 🔴 Pendente | Inexistente | Não implementado. |
| Pings de automação de cron (17:50 e 23:15) | 🔴 Pendente | Inexistente | Não implementado. |

---

### Fase 4 — Preparo interno (beneficiados) e registro de perdas

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Sub-fichas técnicas de beneficiados | 🔴 Pendente | Inexistente | Exemplificado no seed (`PRODUÇÃO: Maionese da Casa`), mas sem suporte na API/interface. |
| Botão "Produzir Xg de [beneficiado]" | 🔴 Pendente | Inexistente | Não implementado. |
| Validade (dias) com alerta | 🔴 Pendente | Inexistente | Não modelado no `schema.prisma`. |
| Interface "one-tap" de registro de perdas | 🔴 Pendente | Inexistente | Não implementado. |
| Gravação de perdas (motivo + timestamp) | 🔴 Pendente | Inexistente | Entidade de Perdas não existe no banco de dados. |
| Relatório/Query de perdas por motivo/mês | 🔴 Pendente | Inexistente | Não implementado. |

---

### Fase 5 — Notas fiscais: XML e Scanner QR Code

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Parser de XML de NF-e | 🔴 Pendente | Inexistente | Nenhuma biblioteca de XML instalada. |
| Conversão de unidades (atacado → cozinha) | 🔴 Pendente | Inexistente | Não implementado. |
| Tela de upload e preview de itens | 🔴 Pendente | Inexistente | Não implementado. |
| Scanner de QR Code via câmera do celular | 🔴 Pendente | Inexistente | Nenhuma biblioteca de scanner instalada. |
| Scraping da página do SEFAZ-MS (cheerio) | 🔴 Pendente | Inexistente | Não implementado. |
| Tela de confirmação e fallback manual | 🔴 Pendente | Inexistente | Não implementado. |

---

### Fase 6 — Dashboard e Gráficos

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Biblioteca de gráficos no React (Recharts) | 🔴 Pendente | Inexistente | `recharts` não instalado. |
| Endpoints agregados (perdas, consumo, etc.) | 🔴 Pendente | Inexistente | Não implementado. |
| Layout mobile-first do dashboard | 🔴 Pendente | Inexistente | Não implementado. |

---

### Fase 7 — Automação, deploy e checklist de lançamento

| Item do Plano | Status | Arquivo / Evidência | Observações / Divergências |
| :--- | :---: | :--- | :--- |
| Cron para dias/horários de funcionamento | 🔴 Pendente | Inexistente | Não configurado. |
| Configuração de produção (Koyeb / Vercel) | 🔴 Pendente | Inexistente | Não configurado. |
| Rotina de purga/arquivamento de histórico | 🔴 Pendente | Inexistente | Não implementado. |
| Alertas externos (Discord/Telegram/E-mail) | 🔴 Pendente | Inexistente | Não implementado. |
| Testes com cliente em operação real | 🔴 Pendente | Inexistente | Não iniciado. |

---

## 2. Divergências entre o Plano e a Implementação Real

1. **Nome do Projeto**:
   - **Plano**: Identificado como `BurgerStock`.
   - **Código**: Definido como `Burguer House` (no [package.json](file:///mnt/Projetos/burguer_house/package.json), [docker-compose.yml](file:///mnt/Projetos/burguer_house/docker-compose.yml) e [AGENTS.md](file:///mnt/Projetos/burguer_house/AGENTS.md)), embora o endpoint de healthcheck ainda responda `BurgerStock API`.

2. **Nomenclatura de Atributos no Banco de Dados**:
   - **Plano**: Pedia atributos em snake_case: `fator_perda`, `estoque_atual`, `estoque_minimo`.
   - **Código**: Implementado em camelCase: `fatorPerda`, `estoqueAtual`, `estoqueMinimo` no [schema.prisma](file:///mnt/Projetos/burguer_house/backend/prisma/schema.prisma) e no banco PostgreSQL.

3. **Tecnologias de Estilização no Frontend**:
   - **Plano**: Especifica explicitamente `React 19.2 + Vite + Tailwind` com layout mobile-first em cards.
   - **Código**: O [frontend/package.json](file:///mnt/Projetos/burguer_house/frontend/package.json) possui React 19.2 e Vite, mas **não possui Tailwind CSS** instalado. A UI foi estruturada com tabela HTML tradicional (`<table>`) e estilos inline/CSS puro.

4. **Configuração do Prisma ORM**:
   - **Plano**: Cita a versão `^7` do Prisma.
   - **Código**: O arquivo de configuração gerado e lido pela CLI é [backend/prisma7.config.ts](file:///mnt/Projetos/burguer_house/backend/prisma7.config.ts) (em vez do convencional `prisma.config.ts`).

5. **Dados de Seed**:
   - **Plano**: Previa um seed simples com 10–15 insumos fictícios e 3–4 produtos fictícios.
   - **Código**: O [backend/prisma/seed.ts](file:///mnt/Projetos/burguer_house/backend/prisma/seed.ts) contém um conjunto completo e detalhado com 49 insumos reais e fichas técnicas reais da hamburgueria.

6. **Arquitetura de Pastas do Backend**:
   - **Plano**: Não detalhava a divisão interna de arquitetura.
   - **Código**: Adotou Clean Architecture / Modular dividida em camadas:
     - `backend/src/infra/http/` (controllers, routes, Fastify app e server)
     - `backend/src/infra/database/` (conexão Prisma adapter)
     - `backend/src/modules/<modulo>/repositories/` (padrão Repository)

7. **Validação de Entrada nos Controllers**:
   - **Plano / AGENTS.md**: Regra mandatória de validação com Zod nos controllers.
   - **Código**: No [backend/src/infra/http/controllers/insumos.controller.ts](file:///mnt/Projetos/burguer_house/backend/src/infra/http/controllers/insumos.controller.ts), o payload ainda utiliza coerção manual (`request.body as any`), com Zod ainda pendente de introdução.

8. **Ambiente de Testes Automatizados**:
   - **Plano**: Previa apenas CI básico e Postgres local de desenvolvimento.
   - **Código**: Foi adicionado isolamento de testes completo com Vitest, segundo container PostgreSQL dedicado na porta 5433 (`burguer_house_test`) e suíte de testes unitários/integração para repositórios.
