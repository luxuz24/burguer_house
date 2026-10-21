# Status de execução do projeto: Burguer House (BurgerStock)

Compara o planejamento do [PLANO.md](PLANO.md) com o que **existe hoje no código**. Atualizado em 21/10/2026, com a `main` até o PR #32. A visão técnica do sistema está em [arquitetura.md](arquitetura.md), o contrato das rotas em [api.md](api.md) e as pendências e decisões em [requests.md](requests.md).

**Legenda:** ✅ Feito (implementado e comprovado no código) · 🟡 Parcial (existe, com limite ou diferença em relação ao plano) · 🔴 Pendente (não existe, ou depende de algo externo ao repositório)

## 0. Resumo

| Fase | Situação | Em uma frase |
|---|---|---|
| 0. Ambiente | 🟡 | Monorepo, Docker, Fastify, Prisma, React e Tailwind prontos. Contas de hospedagem ainda não criadas |
| 1. Fundação | 🟡 | Banco, seed, `/health` e CI prontos. Falta o deploy "vazio" na nuvem |
| 2. Insumos e fichas | ✅ | Cadastro, fichas técnicas e alerta de estoque mínimo, com telas em cartões (teste manual sem registro) |
| 3. Vendas e consolidação | 🟡 | Webhook e consolidação funcionando. Faltam os adicionais e o formato real do webhook |
| 4. Preparo interno e perdas | ✅ | Sub-fichas, produção e perdas com tela de um toque (validade com limite, ver 1.4) |
| 5. Notas fiscais | 🟡 | XML e QR code funcionando. Scraping ainda não validado em uma nota real |
| 6. Dashboard | ✅ | Endpoint agregado e telas com Recharts (desempenho não medido) |
| 7. Automação e deploy | 🔴 | Cron pronto, mas desligado. Produção, purga, alertas e teste com o cliente pendentes |

**Números:** 147 testes automatizados do backend (20 arquivos), todos passando; 6 migrations; 9 PRs entre #24 e #32 (segurança, estoque, infraestrutura e frontend).

---

## 1. Status por fase

### 1.1 Fase 0: Setup do ambiente

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Node.js (plano: 24 LTS) | ✅ | `package.json`, `.github/workflows/ci.yml` | CI roda com Node 22; o desenvolvimento local usa Node 24 |
| Monorepo `/backend` e `/frontend` | ✅ | `package.json` (scripts com `concurrently`) | `npm run dev` sobe os dois |
| PostgreSQL local via Docker Compose | ✅ | `docker-compose.yml` | Dois containers: desenvolvimento e teste |
| Fastify 5 e Prisma 7 travados | ✅ | `backend/package.json` | Fastify `^5.12.5`, Prisma `^7.10.0` |
| `prisma init` e `DATABASE_URL` | ✅ | `backend/prisma/schema.prisma`, `backend/prisma7.config.ts` | Adapter `pg` |
| Frontend React 19.2 + Vite + Tailwind | ✅ | `frontend/package.json`, `frontend/src/index.css` | Tailwind 4.3 instalado (a versão anterior deste documento dizia que não) |
| Contas Neon, Koyeb e Vercel | 🔴 | n/a (externo) | Nada no repositório indica deploy |
| `.env.example` documentado | ✅ | `backend/.env.example`, `frontend/.env.example` | Segredos, pool, CORS, proxy e URL da API |
| Conta no cron externo | 🟡 | `.github/workflows/cron.yml` | Escolhido o GitHub Actions; o agendamento fica desligado até a variável `CRON_ATIVO=true` |

### 1.2 Fase 1: Fundação

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Modelagem (`Insumo`, `Produto`, `FichaTecnica`, `Venda`) | ✅ | `backend/prisma/schema.prisma` | Além deles: `Perda`, `SubFichaTecnica`, `NotaFiscal`, `ItemNotaFiscal` e `Usuario` |
| Migrations | ✅ | `backend/prisma/migrations/` | Seis migrations, da `init` aos índices e ao `externalId` da venda |
| Seed | ✅ | `backend/prisma/seed.ts` | Mais do que o plano: 49 insumos reais, 6 produtos com ficha técnica e a maionese da casa como beneficiado, mais o usuário administrador |
| `GET /health` | ✅ | `backend/src/infra/http/routes/health.routes.ts` | Público; usado pelo ping de aquecimento |
| CI básico | ✅ | `.github/workflows/ci.yml` | Lint do frontend, `prisma validate` e `generate`, build dos dois, testes com Postgres |
| Primeiro deploy "vazio" (Koyeb e Neon) | 🔴 | n/a | Não há deploy |

### 1.3 Fase 2: Insumos, almoxarifado e fichas técnicas

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| CRUD de insumos | ✅ | `insumos.controller.ts`, `insumos.repository.ts` | Validação com Zod; atualização parcial sem sobrescrever campos |
| Ficha técnica por produto | ✅ | `fichas_tecnicas.controller.ts`, `frontend/src/pages/FichaTecnica.tsx` | A parte "multi-nível" é feita pelas sub-fichas da Fase 4 |
| Lógica e endpoint de estoque mínimo | ✅ | `GET /api/insumos/alertas` | |
| Tela mobile-first com cartões de alerta | ✅ | `frontend/src/pages/Estoque.tsx` | Cartões, sem tabela HTML |
| Teste manual do fator de perda | 🟡 | `consolidacao.service.spec.ts` | Coberto por teste automatizado; não há registro de teste manual |

### 1.4 Fase 3: Vendas (webhook) e consolidação

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| `POST /webhook/anota-ai` | ✅ | `webhook.controller.ts` | **Diverge do plano:** grava antes de responder e devolve 500 em falha, para a Anota AI reenviar |
| Validação do token da Anota AI | ✅ | `ANOTAAI_WEBHOOK_SECRET` (header `x-webhook-secret` ou `?token=`) | Não está confirmado se a Anota AI permite enviar segredo, e o corpo real do webhook ainda não foi visto |
| Log de erro na gravação | ✅ | `webhook.controller.ts` | Há log e resposta 500; **não há alerta externo** (ver Fase 7) |
| Deduplicação por pedido | ✅ | `Venda.externalId`, `extrair_id_externo.ts` | Último evento do pedido vale enquanto ele não foi consolidado |
| Consolidação (`POST /api/vendas/consolidar`) | ✅ | `consolidacao.service.ts` | Autenticada por `CRON_SECRET` (não por JWT); respeita o estado do pedido (`check`) |
| Idempotência da consolidação | ✅ | `consolidacao.service.spec.ts` | Reivindicação dentro da transação; duas execuções não descontam em dobro |
| Modificadores e adicionais ("bacon extra") | 🔴 | n/a | `subItems` do payload não são tratados; depende de um payload real |
| Pings do cron (17:50 e 23:15) | 🟡 | `.github/workflows/cron.yml` | Workflow pronto (quarta a domingo, horário em UTC), desligado até `CRON_ATIVO=true` |
| Simular um dia de vendas (≈20 webhooks) | 🟡 | `webhook_eventos.spec.ts` | Há testes dos cenários; falta um script de simulação em lote |

### 1.5 Fase 4: Preparo interno e perdas

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Sub-fichas técnicas | ✅ | `preparo_interno.controller.ts`, `PreparoInterno.tsx` | |
| "Produzir Xg" | ✅ | `producao.service.ts` | Baixa atômica; 409 se o estoque dos brutos for insuficiente |
| Validade em dias com alerta | 🟡 | `Estoque.tsx` (`calcularValidade`) | Campo e alerta (≤ 2 dias) existem, mas a contagem parte da última atualização do insumo, e não do lote produzido |
| Perdas com interface de um toque | ✅ | `frontend/src/pages/Perdas.tsx` | Botões por motivo |
| Gravação da perda (motivo e data) | ✅ | `perdas.repository.ts` | Aceita perda maior que o saldo e sinaliza `estoqueNegativo` |
| Resumo de perdas por motivo e mês | ✅ | `GET /api/perdas/resumo-mensal` | O valor em reais aparece no dashboard (usa `custoUnitario`) |

### 1.6 Fase 5: Notas fiscais

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Parser de XML de NF-e | ✅ | `xml_parser.service.ts` (`fast-xml-parser`) | Limite de 500 KB |
| Conversão de unidades | 🟡 | `sugerirConversao` | Converte kg↔g e L↔ml; outras unidades ficam 1 para 1, com ajuste manual na tela |
| Tela de upload e prévia | ✅ | `frontend/src/pages/ImportarNotaFiscal.tsx` | |
| Scanner de QR code pela câmera | ✅ | `html5-qrcode`; câmera nativa no celular (#32) | HTTPS opcional no Vite para a câmera funcionar na rede local |
| Leitura da página pública da SEFAZ | 🟡 | `qrcode_parser.service.ts` (`cheerio`), `safe_fetch.ts` | Genérica para portais `*.gov.br`; sem validação registrada contra uma nota real |
| Confirmação e alternativa manual | ✅ | `ImportarNotaFiscal.tsx` | Sem scraping, devolve a chave de acesso e segue pelo XML |
| Vínculo inteligente de itens com insumos | ✅ | `xml_parser.service.ts` | Não estava no plano: histórico, nome exato, sinônimos e similaridade |
| Entrada no estoque sem duplicar | ✅ | `entrada_estoque.service.ts` | Chave de acesso única; reimportar devolve 409 |

### 1.7 Fase 6: Dashboard

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Biblioteca de gráficos | ✅ | `recharts` | |
| Endpoint agregado por período | ✅ | `GET /api/dashboard/resumo` | Período `hoje`, `semana`, `mes` ou personalizado (máximo de 366 dias); ignora pedidos cancelados |
| Layout mobile-first | ✅ | `frontend/src/pages/Dashboard.tsx` | |
| Critério "carrega em menos de 2 s" | 🔴 | n/a | Não medido |

### 1.8 Fase 7: Automação, deploy e lançamento

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Cron nos dias e horários certos | 🟡 | `.github/workflows/cron.yml` | Pronto, falta ligar |
| Variáveis de produção (Koyeb e Vercel) | 🔴 | n/a | Lista em `requests.md` |
| Teste "loja fechada seg e ter, primeiro pedido na quarta" | 🔴 | n/a | Depende do deploy |
| Purga mensal trocada por arquivamento | 🔴 | n/a | Não existe rotina de purga nem de arquivamento |
| Alerta externo de falha | 🔴 | n/a | Não implementado |
| Uma semana de teste com o cliente | 🔴 | n/a | Não iniciado |

---

## 2. Divergências entre o plano e o código

1. **Nome do projeto.** O plano diz `BurgerStock`; o repositório e o `AGENTS.md` usam `Burguer House`, e a API responde `BurgerStock API` no `/health`.
2. **Atributos em camelCase.** O plano pedia snake_case (`fator_perda`); o banco usa `fatorPerda`, `estoqueAtual`, `estoqueMinimo`.
3. **Prisma.** O arquivo de configuração é `backend/prisma7.config.ts`, e não `prisma.config.ts`.
4. **Seed.** O plano previa dados fictícios; o seed traz os insumos e as fichas reais da hamburgueria.
5. **Arquitetura do backend.** Modular em camadas: `infra/http` (rotas, controllers, app), `infra/database` e `modules/<modulo>` (serviços e repositories).
6. **Webhook.** O plano pedia resposta 200 imediata com gravação depois ("fire-and-forget"). O código **grava antes de responder**, para que uma falha vire 500 e a Anota AI reenvie. Risco: se o banco estiver "acordando" e a gravação passar de 5 s, a Anota AI pode reenviar (a deduplicação por pedido cobre isso).
7. **Autenticação da consolidação.** O plano falava em `POST /consolidar` ou job agendado; o código exige o header `x-cron-secret` (`CRON_SECRET`), sem JWT, para o cron não depender de senha de usuário.
8. **Agendador externo.** O plano citava cron-job.org ou GitHub Actions; foi escolhido o **GitHub Actions**.
9. **Testes.** O plano previa só CI básico. Hoje há 147 testes (Vitest) com um banco de teste isolado, inclusive de concorrência.
10. **Validação com Zod.** A pendência anterior (insumos, produtos e fichas sem validação) foi resolvida no PR #24.

## 3. Itens fora do plano que já foram implementados

- **Autenticação:** login, JWT exigido em todas as rotas (exceto `/health`, login, webhook e consolidação), perfil, troca de senha, limite de tentativas de login. As roles (`ADMIN`, `GERENTE`, `OPERADOR`) existem no banco, mas **ainda não restringem nada**.
- **Segurança:** proteção contra SSRF na leitura do QR code, comparação de segredos em tempo constante, CORS por variável de ambiente, tratamento central de erros sem vazar detalhes.
- **Estado do pedido:** a consolidação abate só pedidos aceitos, descarta cancelados e deixa pendentes os ainda não aceitos (PR #31).
- **Infraestrutura:** encerramento limpo do servidor, porta por `PORT`, pool do Postgres com timeouts, índices de consulta, proxy `/api` no Vite e `VITE_API_URL`.

## 4. O que falta e quem decide

| Pendência | Depende de | Onde está registrada |
|---|---|---|
| Confirmar o formato real do webhook (ID do pedido, `check`, itens) | Ambiente de teste de 7 dias da Anota AI | [requests.md](requests.md) |
| Adicionais (`subItems`) na consolidação | O payload real acima | [requests.md](requests.md) |
| Cancelamento depois da consolidação (devolver o insumo ou registrar perda) | Decisão do dono da loja | [requests.md](requests.md) |
| Permissões por role | Decisão de produto | [requests.md](requests.md) |
| Deploy, variáveis de produção e ligar o cron | Contas Neon, Koyeb e Vercel | [requests.md](requests.md) |
| Purga e arquivamento, alerta externo de falha | A definir | Fase 7 do [PLANO.md](PLANO.md) |
| Validar o scraping com uma nota real | Uma nota da loja | Fase 5 do [PLANO.md](PLANO.md) |
| Semana de teste com o cliente | Tudo acima | Fase 7 do [PLANO.md](PLANO.md) |
