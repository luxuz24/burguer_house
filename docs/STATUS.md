# Status de execução do projeto: Burguer House (BurgerStock)

Compara o planejamento do [PLANO.md](PLANO.md) com o que **existe hoje no código**. Atualizado em 17/11/2026, com a `main` até o PR #116. A visão técnica do sistema está em [arquitetura.md](arquitetura.md), o contrato das rotas em [api.md](api.md) e as pendências e decisões em [requests.md](requests.md).

**Legenda:** ✅ Feito (implementado e comprovado no código) · 🟡 Parcial (existe, com limite ou diferença em relação ao plano) · 🔴 Pendente (não existe, ou depende de algo externo ao repositório)

## 0. Resumo

| Fase | Situação | Em uma frase |
|---|---|---|
| 0. Ambiente | 🟡 | Monorepo, Docker, Fastify, Prisma, React e Tailwind prontos. Contas de hospedagem ainda não criadas |
| 1. Fundação | 🟡 | Banco, seed, `/health` e CI prontos. Falta o deploy "vazio" na nuvem |
| 2. Insumos e fichas | ✅ | Cadastro com categoria (ingrediente, embalagem, bebida) e abas no Estoque, fichas técnicas e alerta de estoque mínimo. Faltam as telas de entrada manual e de histórico |
| 3. Vendas e consolidação | 🟡 | Webhook em modo sombra, consolidação, vendas retidas e **fechamento manual do dia** (com estorno) funcionando. Falta o payload real da Anota AI |
| 4. Preparo interno e perdas | ✅ | Sub-fichas, produção e perdas com tela de um toque (validade com limite, ver 1.5) |
| 5. Notas fiscais | 🟡 | XML e QR code funcionando. Scraping ainda não validado em uma nota real |
| 6. Dashboard | ✅ | Saída em **quantidade**, sem faturamento em R$ (decisão do dono). Desempenho não medido |
| 7. Automação e deploy | 🔴 | Cron pronto (com alerta de vendas retidas), mas desligado. Produção, purga e teste com o cliente pendentes |

**Números:** backend com 573 testes (61 arquivos) e frontend com 683 (38 arquivos), todos passando; teste de mutação (Stryker) nas telas e módulos endurecidos; 12 migrations; PRs #33 a #116 desde a última atualização (endurecimento do backend, redesenho do frontend e as funcionalidades da hamburgueria).

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
| Frontend React 19.2 + Vite + Tailwind | ✅ | `frontend/package.json`, `frontend/src/index.css` | Vite 8 e Tailwind 4.3, com tokens de cor (claro e escuro) da fundação visual F0.5 |
| Contas Neon, Koyeb e Vercel | 🔴 | n/a (externo) | Nada no repositório indica deploy |
| `.env.example` documentado | ✅ | `backend/.env.example`, `frontend/.env.example` | Segredos, pool, CORS, proxy e URL da API |
| Conta no cron externo | 🟡 | `.github/workflows/cron.yml` | Escolhido o GitHub Actions; o agendamento fica desligado até a variável `CRON_ATIVO=true` |

### 1.2 Fase 1: Fundação

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Modelagem (`Insumo`, `Produto`, `FichaTecnica`, `Venda`) | ✅ | `backend/prisma/schema.prisma` | Além deles: `Perda`, `SubFichaTecnica`, `NotaFiscal`, `ItemNotaFiscal`, `Usuario` e `MovimentacaoEstoque` |
| Migrations | ✅ | `backend/prisma/migrations/` | Doze migrations: da `init` ao `tokenVersion` do usuário, custo histórico da perda, categoria do insumo, origem e `ocorridoEm` da venda e movimentação de estoque |
| Seed | ✅ | `backend/prisma/seed.ts` | Mais do que o plano: 49 insumos reais, 6 produtos com ficha técnica e a maionese da casa como beneficiado, mais o usuário administrador |
| `GET /health` | ✅ | `backend/src/infra/http/routes/health.routes.ts` | Público; usado pelo ping de aquecimento |
| CI básico | ✅ | `.github/workflows/ci.yml` | Lint do frontend, `prisma validate` e `generate`, build dos dois, testes do backend (com Postgres) e do frontend (Vitest + JSDOM) |
| Primeiro deploy "vazio" (Koyeb e Neon) | 🔴 | n/a | Não há deploy |

### 1.3 Fase 2: Insumos, almoxarifado e fichas técnicas

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| CRUD de insumos | ✅ | `insumos.controller.ts`, `insumos.repository.ts` | Validação com Zod; atualização parcial sem sobrescrever campos |
| Ficha técnica por produto | ✅ | `fichas_tecnicas.controller.ts`, `frontend/src/pages/FichaTecnica.tsx` | A parte "multi-nível" é feita pelas sub-fichas da Fase 4 |
| Lógica e endpoint de estoque mínimo | ✅ | `GET /api/insumos/alertas` | |
| Tela mobile-first com cartões de alerta | ✅ | `frontend/src/pages/Estoque.tsx` | Cartões, sem tabela HTML; editar e excluir dentro do Sheet (#111) |
| Teste manual do fator de perda | 🟡 | `consolidacao.service.spec.ts` | Coberto por teste automatizado; não há registro de teste manual |
| Categoria do insumo (fora do plano) | ✅ | `Insumo.categoria`; `Estoque.tsx` | Ingrediente, embalagem ou bebida; filtro e alertas no backend (#99), abas no Estoque (#113), escolha e troca no cadastro (#114) |
| Entrada manual de estoque e histórico (fora do plano) | 🟡 | `entrada_manual.service.ts`, `MovimentacaoEstoque` | Backend pronto (#100); faltam as telas (tarefas front 15 e 16) |
| Ajuste e inventário de estoque | 🔴 | n/a | Bloqueado por decisão do dono (tarefa back 14) |

### 1.4 Fase 3: Vendas (webhook) e consolidação

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| `POST /webhook/anota-ai` | ✅ | `webhook.controller.ts`, [MODO_SOMBRA_ANOTAAI.md](MODO_SOMBRA_ANOTAAI.md) | **Diverge do plano:** grava antes de responder e devolve 500 em falha, para a Anota AI reenviar. Modo sombra: grava sem abater, para conferir o payload real (#93) |
| Validação do token da Anota AI | ✅ | `ANOTAAI_WEBHOOK_SECRET` (header `x-webhook-secret` ou `?token=`) | Não está confirmado se a Anota AI permite enviar segredo, e o corpo real do webhook ainda não foi visto |
| Log de erro na gravação | ✅ | `webhook.controller.ts` | Há log e resposta 500; **não há alerta externo** (ver Fase 7) |
| Deduplicação por pedido | ✅ | `Venda.externalId`, `extrair_id_externo.ts` | Último evento do pedido vale enquanto ele não foi consolidado |
| Consolidação (`POST /api/vendas/consolidar`) | ✅ | `consolidacao.service.ts` | Autenticada por `CRON_SECRET` (não por JWT); respeita o estado do pedido (`check`) |
| Idempotência da consolidação | ✅ | `consolidacao.service.spec.ts` | Reivindicação dentro da transação; duas execuções não descontam em dobro |
| Modificadores e adicionais ("bacon extra") | 🟡 | `extrair_itens.ts`, `anotaai.adapter.ts` | `subItems` são tratados como produtos do cardápio; observação sem produto ("sem cebola") retém a venda. A regra final depende do payload real (tarefa back 18) |
| Pings do cron (17:50 e 23:15) | 🟡 | `.github/workflows/cron.yml` | Workflow pronto (quarta a domingo, horário em UTC), desligado até `CRON_ATIVO=true` |
| Simular um dia de vendas (≈20 webhooks) | ✅ | `backend/scripts/replay-vendas.ts`, teste ponta a ponta do dia completo (#105) | |
| Vendas retidas (fora do plano) | ✅ | `GET /api/vendas/retidas`, `POST /api/vendas/marcar-tratadas` | Venda que não casa com o cardápio fica retida, com motivo; painel e atalho para o cardápio no front (#94, #96, #108) |
| Fechamento manual do dia (fora do plano) | ✅ | `fechamento_manual.service.ts`; tela "Fechar o dia" | Enquanto o webhook não está ativo, o operador lança o que saiu e o estoque baixa pelas fichas: simulação, confirmação idempotente, estorno e lista do dia (#101–#103, #109, #110, #112) |
| Convivência entre fechamento manual e webhook | 🔴 | n/a | Bloqueada: decisão do dono e formato real do webhook (tarefa back 27) |
| Cancelamento depois da consolidação | 🔴 | n/a | Bloqueado por decisão do dono (tarefa back 19) |

### 1.5 Fase 4: Preparo interno e perdas

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Sub-fichas técnicas | ✅ | `preparo_interno.controller.ts`, `PreparoInterno.tsx` | |
| "Produzir Xg" | ✅ | `producao.service.ts` | Baixa atômica; 409 se o estoque dos brutos for insuficiente |
| Validade em dias com alerta | 🟡 | `Estoque.tsx` (`calcularValidade`) | Campo e alerta (≤ 2 dias) existem, mas a contagem parte da última atualização do insumo, e não do lote produzido (validade por lote bloqueada: dono + schema, tarefa back 15) |
| Perdas com interface de um toque | ✅ | `frontend/src/pages/Perdas.tsx` | Botões por motivo |
| Gravação da perda (motivo e data) | ✅ | `perdas.repository.ts` | Aceita perda maior que o saldo e sinaliza `estoqueNegativo`; custo histórico gravado na perda (#48) |
| Resumo de perdas por motivo e mês | ✅ | `GET /api/perdas/resumo-mensal` | O valor em reais aparece no dashboard (usa `custoUnitario`) |

### 1.6 Fase 5: Notas fiscais

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Parser de XML de NF-e | ✅ | `xml_parser.service.ts` (`fast-xml-parser`) | Limite de 500 KB |
| Conversão de unidades | 🟡 | `sugerirConversao` | Converte kg↔g e L↔ml com unidades canônicas e a mesma regra no front e no back (#44–#46); outras unidades ficam 1 para 1, com ajuste manual na tela |
| Tela de upload e prévia | ✅ | `frontend/src/pages/ImportarNotaFiscal.tsx` | Fluxo em 3 passos (#69, #74) |
| Scanner de QR code pela câmera | ✅ | `html5-qrcode`; câmera nativa no celular (#32) | HTTPS opcional no Vite para a câmera funcionar na rede local |
| Leitura da página pública da SEFAZ | 🟡 | `qrcode_parser.service.ts` (`cheerio`), `safe_fetch.ts` | Genérica para portais `*.gov.br`, com prazo total de leitura; sem validação registrada contra uma nota real |
| Confirmação e alternativa manual | ✅ | `ImportarNotaFiscal.tsx` | Sem scraping, devolve a chave de acesso e segue pelo XML |
| Vínculo inteligente de itens com insumos | ✅ | `xml_parser.service.ts` | Não estava no plano: histórico, nome exato, sinônimos e similaridade |
| Entrada no estoque sem duplicar | ✅ | `entrada_estoque.service.ts` | Chave de acesso única; reimportar devolve 409 |

### 1.7 Fase 6: Dashboard

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Biblioteca de gráficos | ✅ | `recharts` | Remoção proposta e bloqueada até aprovação do dono (tarefa front 08) |
| Endpoint agregado por período | ✅ | `GET /api/dashboard/resumo` | Período `hoje`, `semana`, `mes` ou personalizado (máximo de 366 dias); conta pelo `ocorridoEm`, inclui vendas MANUAL e ignora cancelados e estornos (#104) |
| Saída do dia em quantidade (fora do plano) | ✅ | `GET /api/estoque/saida-dia`; `Inicio.tsx`, `Dashboard.tsx` | **Decisão do dono:** o app é de estoque, não de finanças. Início e Relatórios mostram o que saiu em quantidade, sem faturamento em R$ (#107, #115) |
| Layout mobile-first | ✅ | `frontend/src/pages/Dashboard.tsx` | Tela de Relatórios no layout do esboço, com período personalizado (#66, #73) |
| Critério "carrega em menos de 2 s" | 🔴 | n/a | Não medido |

### 1.8 Fase 7: Automação, deploy e lançamento

| Item do plano | Status | Evidência | Observações |
|---|:---:|---|---|
| Cron nos dias e horários certos | 🟡 | `.github/workflows/cron.yml` | Pronto, falta ligar |
| Variáveis de produção (Koyeb e Vercel) | 🔴 | n/a | Lista em `requests.md` |
| Teste "loja fechada seg e ter, primeiro pedido na quarta" | 🔴 | n/a | Depende do deploy |
| Purga mensal trocada por arquivamento | 🔴 | n/a | Não existe rotina de purga nem de arquivamento |
| Alerta externo de falha | 🟡 | `.github/workflows/cron.yml` + `backend/scripts/checar-consolidacao.mjs` | Cron falha e escreve resumo no Actions (dispara e-mail do GitHub) se houver vendas retidas ou erro HTTP (#95); monitoramento em tempo real do webhook e alerta via WhatsApp/Telegram ficam como melhoria futura |
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
9. **Testes.** O plano previa só CI básico. Hoje há 573 testes no backend (Vitest, banco de teste isolado, inclusive de concorrência) e 683 no frontend (Vitest + JSDOM), com teste de mutação (Stryker) nas partes endurecidas.
10. **Validação com Zod.** A pendência anterior (insumos, produtos e fichas sem validação) foi resolvida no PR #24; as mensagens saem em português (#86).
11. **Valores em R$.** O plano previa gráficos de custo e faturamento. Por decisão do dono, o app é de estoque: Início e Relatórios mostram a saída em quantidade, e o faturamento em R$ não aparece (#115).
12. **Vendas sem webhook.** O plano supunha a Anota AI desde o início. Como a integração ainda não está ativa, existe o fechamento manual do dia (#101–#103), e o webhook roda em modo sombra (#93).

## 3. Itens fora do plano que já foram implementados

- **Autenticação:** login, JWT exigido em todas as rotas (exceto `/health`, login, webhook e consolidação), perfil, troca de senha, logout que revoga o token (`tokenVersion`), limite de tentativas de login. As roles (`ADMIN`, `GERENTE`, `OPERADOR`) existem no banco e o guard `exigirRole` está pronto, mas **nenhuma rota o usa**: falta a matriz de permissões (decisão do dono, tarefa back 13).
- **Segurança:** proteção contra SSRF na leitura do QR code, comparação de segredos em tempo constante, CORS por variável de ambiente, tratamento central de erros sem vazar detalhes.
- **Estado do pedido:** a consolidação abate só pedidos aceitos, descarta cancelados e deixa pendentes os ainda não aceitos (PR #31).
- **Infraestrutura:** encerramento limpo do servidor, porta por `PORT`, pool do Postgres com timeouts, índices de consulta, `bodyLimit` explícito (413 em português), proxy `/api` no Vite e `VITE_API_URL`.
- **Frontend redesenhado:** fundação visual (tokens claro/escuro, ícones Phosphor, barra inferior, mascote) e todas as telas no layout do esboço (#57–#74), com endurecimento de sessão, modais e virada da meia-noite (#72–#84).
- **Fluxo de vendas da hamburgueria:** modo sombra, vendas retidas, marcar como tratadas e fechamento manual do dia com estorno (ver 1.4).

## 4. O que falta e quem decide

| Pendência | Depende de | Onde está registrada |
|---|---|---|
| Telas de entrada manual de estoque, histórico do insumo e pedidos do fechamento manual nos relatórios | Agente FRONT (tarefas 15, 16 e 17) | [tarefas/frontend](tarefas/frontend/README.md) |
| Conferência visual e mutação das telas da Fase 4 | Agente FRONT, por último (tarefas 18 e 19) | [tarefas/frontend](tarefas/frontend/README.md) |
| Confirmar o formato real do webhook (ID do pedido, `check`, itens) | Ambiente de teste de 7 dias da Anota AI | [requests.md](requests.md) |
| Adicionais (`subItems`), vínculo pelo código da Anota AI e convivência manual × webhook | O payload real acima e decisão do dono (tarefas back 17, 18 e 27) | [tarefas/backend](tarefas/backend/README.md) |
| Cancelamento depois da consolidação (devolver o insumo ou registrar perda) | Decisão do dono da loja (tarefa back 19) | [requests.md](requests.md) |
| Permissões por role | Decisão do dono (tarefa back 13) | [requests.md](requests.md) |
| Ajuste/inventário de estoque, validade por lote, insumo sem mínimo como crítico, produto vendável × interno | Decisão do dono e, em parte, schema (tarefas back 07, 14, 15 e 16) | [tarefas/backend](tarefas/backend/README.md) |
| Remover o `recharts` | Aprovação do dono (tarefa front 08) | [tarefas/frontend](tarefas/frontend/README.md) |
| Deploy, variáveis de produção e ligar o cron | Contas Neon, Koyeb e Vercel | [requests.md](requests.md) |
| Purga e arquivamento, alerta externo de falha | A definir | Fase 7 do [PLANO.md](PLANO.md) |
| Validar o scraping com uma nota real | Uma nota da loja | Fase 5 do [PLANO.md](PLANO.md) |
| Semana de teste com o cliente | Tudo acima | Fase 7 do [PLANO.md](PLANO.md) |
