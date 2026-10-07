# BurgerStock — Plano de Execução de Desenvolvimento

Sep 26, 2026 · @Someone

## Resumo executivo

O plano segue uma ordem sequencial: primeiro a fundação técnica (banco, API, ambiente), depois os módulos que o dono usa todo dia (insumos, vendas, perdas), e só depois o que é mais arriscado tecnicamente (notas fiscais e QR code) e o polimento (dashboard, automação). Cada fase só termina quando fecha o dia sem gerar erro — esse é o critério de pronto, não um prazo fixo.

&#91;embedded content: roadmap · 8 fases, do setup ao deploy\]

As datas do desenho acima são uma estimativa de ritmo (cerca de 8 semanas), não um cronograma travado — ajuste conforme a disponibilidade real do grupo.

## Fase 0 — Setup do ambiente de desenvolvimento

Antes de escrever qualquer regra de negócio, deixe o ambiente local e as contas gratuitas prontos:

- [ ] Instalar Node.js 24 LTS (via nvm, pra facilitar trocar de versão depois)
- [ ] Criar o repositório — monorepo com `/backend` e `/frontend` facilita pro TCC (um README só explica tudo)
- [ ] Subir um PostgreSQL 18 local via Docker Compose, só pra desenvolvimento (o Neon entra mais pra frente, no deploy)
- [ ] Inicializar o backend com Fastify `^5.8` e travar o Prisma em `^7` no `package.json` (`"prisma": "^7"` em devDependencies, `"@prisma/client": "^7"` em dependencies) — evita a pegadinha do CLI do Prisma 8 RC
- [ ] Rodar `npx prisma init` e apontar o `DATABASE_URL` pro Postgres local do Docker
- [ ] Inicializar o frontend com React 19.2 + Vite + Tailwind
- [ ] Criar as contas gratuitas: Neon (banco), Koyeb (API), Vercel (frontend) — ainda sem deploy, só reservando o espaço
- [ ] Criar um `.env.example` com todas as variáveis que o projeto vai precisar, mesmo as que ainda não existem — documenta desde já
- [ ] Criar a conta no cron externo (cron-job.org ou GitHub Actions agendado), ainda sem nenhuma tarefa configurada

**Critério de pronto:** `npm run dev` sobe backend e frontend local, conectados ao Postgres do Docker, sem erro.

## Fase 1 — Fundação (banco de dados + API base)

Aqui vocês criam o esqueleto que tudo mais vai usar.

- [ ] Modelar no `schema.prisma` as entidades centrais: `Insumo` (nome, unidade, fator\_perda, estoque\_atual, estoque\_minimo), `Produto`, `FichaTecnica` (produto → insumos + quantidade), `Venda` (payload bruto em JSONB da Anota AI + flag `processado`)
- [ ] Rodar a primeira migration (`npx prisma migrate dev --name init`)
- [ ] Escrever um seed (`prisma/seed.ts`) com uns 10–15 insumos e 3–4 produtos fictícios, pra não depender de dados reais desde o início
- [ ] Criar o endpoint `GET /health` no Fastify, que só confirma que API e banco estão respondendo — vai servir pro cron de aquecimento mais pra frente
- [ ] Configurar um CI básico (GitHub Actions): lint + `prisma validate` a cada push, sem precisar de banco real
- [ ] Subir o primeiro deploy "vazio" — Koyeb com o Fastify, Neon com o schema aplicado — só pra validar que o pipeline de deploy funciona antes de existir qualquer funcionalidade real

**Critério de pronto:** dá pra abrir o Prisma Studio e ver as tabelas com o seed, tanto local quanto no Neon.

## Fase 2 — Insumos, almoxarifado e fichas técnicas

Primeiro módulo "de verdade" — e a base de tudo que vem depois.

- [ ] CRUD de insumos (nome, unidade — g/ml/unidade, fator de perda, estoque atual, estoque mínimo)
- [ ] Tela de cadastro de ficha técnica multi-nível: escolher um produto, adicionar insumos com quantidade, aplicando o fator de perda no cálculo do desconto real
- [ ] Lógica de estoque mínimo: query que marca insumos abaixo do limite, endpoint que o dashboard vai consumir depois
- [ ] Tela React mobile-first: cards vermelhos pros itens em alerta, formulário simples de cadastro/edição
- [ ] Teste manual: cadastrar um produto com 3–4 insumos e conferir se a matemática do fator de perda bate

**Critério de pronto:** dá pra cadastrar um hambúrguer completo (pão, carne, queijo, molho) com a ficha técnica certa, e o sistema já sabe quanto de cada insumo aquele produto consome.

## Fase 3 — Ingestão de vendas (webhook) e consolidação de estoque

O coração do sistema, e depende de duas rotinas separadas — uma em tempo real, outra em lote.

**Caminho do dia (tempo real, todo pedido):**

- [ ] Endpoint `POST /webhook/anota-ai`: responde `200 OK` imediatamente e só depois escreve o payload bruto no JSONB (fire-and-forget com retry) — protege o timeout de 5s da Anota AI mesmo se o Neon estiver acordando
- [ ] Validação básica do payload (assinatura/token da Anota AI, se existir) antes de aceitar
- [ ] Log de erro se a escrita assíncrona falhar depois de todas as tentativas — sem isso, um pedido pode se perder silenciosamente

**Caminho da noite (lote, uma vez por dia de funcionamento):**

- [ ] Rotina de consolidação (`POST /consolidar` ou job agendado): busca as vendas com `processado = false`, itera produtos e adicionais de cada uma, desconta do estoque via a ficha técnica (Fase 2), marca como processado
- [ ] Tratamento de modificadores/adicionais: o item "bacon extra" no payload precisa mapear pro insumo bruto correspondente, não só pro produto
- [ ] Idempotência: rodar a consolidação duas vezes no mesmo dia não pode descontar o estoque em dobro

**Automação (cron externo, só quarta a domingo):**

- [ ] Ping de aquecimento por volta das 17:50, antes de abrir
- [ ] Disparo automático da consolidação por volta das 23:15, depois de fechar

**Critério de pronto:** simular um dia de vendas (script disparando uns 20 webhooks fictícios), rodar a consolidação, e conferir se o estoque bateu certinho com o que a ficha técnica previa.

## Fase 4 — Preparo interno (itens beneficiados) e registro de perdas

Dois módulos menores, mas que fecham o ciclo operacional da cozinha.

**Preparo interno:**

- [ ] Sub-fichas técnicas (ex.: 1kg de maionese caseira = X de óleo + Y de ovo + Z de alho)
- [ ] Botão "Produzir Xg de \[beneficiado\]": desconta os insumos brutos e soma no estoque do item pronto
- [ ] Campo de validade (dias) por beneficiado, com alerta quando estiver perto de vencer

**Registro de perdas:**

- [ ] Interface "one-tap": botões grandes por insumo/motivo (Vencimento, Erro de preparo, Estragado)
- [ ] Cada toque desconta do estoque e grava o registro de perda com motivo e timestamp
- [ ] Query que soma o valor perdido por motivo/mês, pra alimentar o relatório da Fase 6

**Critério de pronto:** "produzir" um lote de maionese e ver o estoque bruto descontado e o de maionese pronta subir; registrar uma perda e vê-la aparecer numa consulta simples de "perdas do mês".

## Fase 5 — Notas fiscais: upload de XML e scanner de QR code

Duas entradas de dados diferentes, com maturidade técnica bem diferente — vale separar em duas entregas.

**Upload manual de XML (mais simples e confiável):**

- [ ] Parser de XML de NF-e (biblioteca tipo `fast-xml-parser` ou `xml2js`)
- [ ] Extrair itens, quantidades e unidades, convertendo a unidade do atacado pra unidade da cozinha (ex.: "peça de 5kg" → "+5000g")
- [ ] Tela de upload + preview dos itens antes de confirmar a entrada no almoxarifado

**Scanner de QR code (mais ambicioso — leia com atenção antes de codar):**

Um ponto importante: o QR code de uma NFC-e **não contém o XML** — ele contém uma URL de consulta pública do SEFAZ do estado (em MS, algo como `www.dfe.ms.gov.br/nfce/qrcode/?p=<chave>|...`). Escaneando, vocês recuperam a chave de acesso (44 dígitos) e acessam uma página HTML pública com os dados resumidos da nota (itens, quantidades, valores, emitente) — não um arquivo `.xml` de verdade. Pegar o XML original exigiria acesso via webservice da SEFAZ com certificado digital do destinatário, o que foge do escopo de um projeto de faculdade.

- [ ] Scanner de QR code no navegador/app (biblioteca tipo `jsQR` ou `html5-qrcode`), lendo pela câmera do celular
- [ ] Extrair a chave de acesso e os parâmetros da URL escaneada
- [ ] Backend busca a página pública de consulta (a mesma que o QR aponta) e faz o parsing do HTML (ex.: `cheerio`) pra extrair os itens
- [ ] Tela de confirmação: mostrar os itens extraídos pro usuário confirmar/ajustar antes de gravar — trate o scraping como sugestão, não como verdade absoluta
- [ ] Fallback: se o parsing falhar (layout mudou, chave inválida, nota cancelada), cair pro fluxo de upload manual

**Critério de pronto:** escanear o QR code de uma nota real (ex.: uma compra de insumos), ver os itens extraídos automaticamente na tela de confirmação, e conseguir corrigir manualmente se algo vier errado.

## Fase 6 — Dashboard e gráficos

Depois que os módulos anteriores já estão gerando dado real, o dashboard vira o "resumo executivo" pro dono.

| Gráfico | Dado usado | Pergunta que responde | Tipo |
| --- | --- | --- | --- |
| Perdas por motivo (mês) | Registros de perda (Fase 4) | Onde o dinheiro está sendo jogado fora? | Barras |
| Consumo de insumos (período) | Consolidação de vendas (Fase 3) | Quais insumos giram mais rápido? | Linha |
| Itens mais vendidos | Vendas processadas | O que vale a pena manter sempre em estoque? | Barras |
| Estoque atual vs mínimo | Cadastro de insumos (Fase 2) | O que está prestes a faltar? | Lista com alerta |
| Custo de compras por fornecedor | Notas fiscais (Fase 5) | De onde vem o maior custo? | Pizza/rosca |

- [ ] Biblioteca de gráfico no React: `recharts` é a opção mais simples de integrar com Tailwind
- [ ] Endpoint agregado por período (dia/semana/mês) pra cada gráfico, calculado sob demanda — nesse volume de dados não precisa de tabela pré-agregada
- [ ] Layout mobile-first, já que o dono acessa principalmente pelo celular

**Critério de pronto:** com um mês de dados simulados, o dashboard carrega em menos de 2 segundos e os números batem com uma conferência manual no banco.

## Fase 7 — Automação, deploy e checklist de lançamento

- [ ] Confirmar que os dois pings do cron (aquecimento e consolidação) rodam só quarta a domingo, no horário certo
- [ ] Variáveis de ambiente de produção configuradas no Koyeb e na Vercel (nunca commitar `.env` real)
- [ ] Testar o cenário "loja fechada segunda e terça inteiras, primeiro pedido de quarta às 18h" de ponta a ponta
- [ ] Revisar a rotina de purga mensal: trocar o `DELETE` puro por um arquivamento (mover pra uma tabela/flag de histórico, ou manter um backup comprimido além do CSV antes de apagar) — dado fiscal não deveria depender só do HD de um notebook
- [ ] Configurar um alerta simples (e-mail ou Discord/Telegram) se o webhook falhar repetidamente ou a consolidação não rodar num dia de funcionamento
- [ ] Testar com o cliente real por pelo menos uma semana de operação antes da entrega final

**Critério de pronto:** o sistema roda uma semana inteira de funcionamento (qua–dom) sem intervenção manual, e o dono só interage com o app pra conferir números — não pra "consertar" nada.

## Riscos técnicos e decisões em aberto

| Risco | Impacto se ignorado | Decisão necessária |
| --- | --- | --- |
| Purga mensal com `DELETE` definitivo | Perda de dado fiscal sem recuperação | Trocar por arquivamento + backup antes de apagar |
| Timeout de 5s da Anota AI | Webhook perdido em horário de abertura/pico | Confirmar se a Anota AI reenvia webhooks que falharam, como segunda camada |
| Scraping da página pública do SEFAZ-MS | Quebra silenciosa se o layout do site mudar | Manter sempre o upload manual de XML como fallback |
| `npm install prisma` instalar o RC do v8 sem querer | Ambiente quebrado sem aviso claro | Travar `prisma` e `@prisma/client` em `^7` já na Fase 0 |
| Prisma ORM 8 sair de RC durante o projeto | Tentação de migrar no meio do desenvolvimento | Só migrar depois da entrega, nunca durante |
| LGPD sobre dados de clientes (CPF na nota) | Exposição de dado pessoal em log/CSV | Definir com o grupo o mínimo necessário de guardar |

**Critério de pronto:** cada linha desta tabela tem uma decisão registrada — mesmo que seja "aceitamos o risco por ser um projeto de faculdade" — antes da entrega final.
