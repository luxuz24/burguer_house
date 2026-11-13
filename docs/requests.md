# Solicitações de Mudanças e Schema (Requests)


> **12/11/2026:** as entradas PENDENTES destinadas ao agente BACK viraram tarefas detalhadas, uma por arquivo, em [`docs/tarefas/backend/`](tarefas/backend/README.md). Ao resolver, marque aqui como RESOLVIDO e lá como FEITA.

## [Fase 4] Novas Tabelas e Campos para Perdas e Preparo Interno — [CONCLUÍDO]

- **Data:** 13/10/2026
- **Status:** **CONCLUÍDO** (Migration `add_perdas_e_preparo_interno` já aplicada na `main`).
- **Módulo Solicitante:** Backend (Fase 4 — Preparo Interno e Registro de Perdas)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

Modelos `Perda`, `SubFichaTecnica`, enum `MotivoPerda` e campos `produzidoInternamente`, `validadeDias` no `Insumo` foram criados e estão ativos.

---

## [Fase 4/6] Adição de `custoUnitario` no Model `Insumo` — [CONCLUÍDO]

- **Data:** 13/10/2026
- **Status:** **CONCLUÍDO** (Migration `add_notas_fiscais_e_custo_unitario` aplicada).
- **Módulo Solicitante:** Backend / Relatórios (Fase 4 & Fase 6)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
O `PLANO.md` (Fase 4 e Fase 6) prevê:
> "Query que soma o valor perdido por motivo/mês, pra alimentar o relatório da Fase 6 (Perdas por motivo - Onde o dinheiro está sendo jogado fora?)"

Atualmente, o modelo `Insumo` armazena apenas quantidades (`estoqueAtual`, `estoqueMinimo`, `fatorPerda`), sem valor monetário / custo unitário (`Float`). Por isso, a agregação de perdas atualmente calcula apenas quantidade física e total de ocorrências.

### Proposta no `schema.prisma`
```prisma
model Insumo {
  // ... campos existentes
  custoUnitario Float @default(0) // Custo em R$ por unidade de medida do insumo
}
```

---

## [Fase 4/6] Adição de `custoUnitario` no Model `Perda` e Fuso Horário de MS — [CONCLUÍDO]

- **Data:** 30/10/2026
- **Status:** **CONCLUÍDO** (Migration `20261030185459_add_perda_custo_unitario` aplicada, `custoUnitario` gravado no model `Perda` e cálculos ajustados no fuso `America/Campo_Grande`).
- **Módulo Solicitante:** Backend / Relatórios (Fase 4 & Fase 6)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
1. **Custo histórico das perdas:** Atualmente, o `resumoMensal` em `PerdasRepository` e o relatório em `DashboardService` multiplicam a quantidade descartada pelo `insumo.custoUnitario` atual. Toda vez que uma nova nota fiscal atualiza o preço do insumo, o valor financeiro de perdas de meses já encerrados é recalculado retroativamente, distorcendo relatórios contábeis passados.
2. **Fuso horário de MS (`America/Campo_Grande` / UTC-4):** Os limites de data do mês (`gte: inicio, lt: fim`) e os valores padrão de query usam métodos UTC (`getUTCMonth`/`getUTCFullYear`). Como a loja opera em Mato Grosso do Sul (UTC-4, sem horário de verão), descarte de insumos ocorrido no horário de pico noturno (ex.: 21h ou 23h de 31/10 em MS) corresponde a 01:00 ou 03:00 UTC de 01/11, caindo no mês seguinte.

### Proposta no `schema.prisma`
```prisma
model Perda {
  id            String      @id @default(uuid())
  insumoId      String
  quantidade    Float
  motivo        MotivoPerda
  custoUnitario Float       @default(0) // Custo em R$ por unidade de medida no momento do descarte
  criadoEm      DateTime    @default(now())

  insumo        Insumo      @relation(fields: [insumoId], references: [id], onDelete: Cascade)

  @@index([criadoEm])
  @@map("perdas")
}
```

### Regras de Negócio e Cálculos
1. **Gravação:** Em `PerdasRepository.registrar`, buscar o `insumo.custoUnitario` no momento da perda e persistir em `perda.custoUnitario`.
2. **Resumo Mensal e Dashboard:** Substituir `(perda.insumo?.custoUnitario ?? 0) * perda.quantidade` por `perda.custoUnitario * perda.quantidade`.
3. **Agregação por Motivo (PER-C):** Remover a soma de `quantidadeTotal` no agrupamento por motivo do `resumoMensal` (ou segregar por insumo), pois somar gramas, mililitros e unidades produz um total fisicamente sem sentido (ex.: 500g + 3 un = 503). Manter `ocorrencias` e `valorTotal`.
4. **Fuso Horário:** Calcular início e fim do mês usando o offset `-04:00` de `America/Campo_Grande`:
   - Início: `YYYY-MM-01T04:00:00.000Z`
   - Fim: Primeiro dia do mês seguinte às `04:00:00.000Z`.

---

## [Fase 4/7] Rastreamento Multi-Lote de Produção (`LoteProducao`) — [OPCIONAL / MELHORIA FUTURA]

- **Data:** 13/10/2026
- **Status:** **OPCIONAL**
- **Módulo Solicitante:** Preparo Interno
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
Atualmente a validade de itens beneficiados é calculada com base na data da última produção (`atualizadoEm + validadeDias`). Caso a operação necessite controlar múltiplos lotes físicos simultâneos na geladeira com datas de fabricação distintas, sugere-se uma tabela de lotes de beneficiamento.

---

## [Fase 5] Tabelas para Notas Fiscais e Itens Comprados (`NotaFiscal`, `ItemNotaFiscal`) — [CONCLUÍDO]

- **Data:** 14/10/2026
- **Status:** **CONCLUÍDO** (Migration `add_notas_fiscais_e_custo_unitario` aplicada).
- **Módulo Solicitante:** Backend / Compras (Fase 5 — Upload de XML e QR Code / Fase 6 — Relatório de Compras por Fornecedor)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
Para atender aos requisitos das Fases 5 e 6 do `PLANO.md`:
1. **Fase 5 (Entrada de Notas Fiscais):** Registrar histórico de compras, chave de acesso de 44 dígitos para evitar notas duplicadas (idempotência), fornecedor (CNPJ e Razão Social), valor total e itens faturados.
2. **Fase 6 (Dashboard - Custo de compras por fornecedor):** Agrupar gastos por fornecedor/mês a partir das notas fiscais importadas.

### Proposta no `backend/prisma/schema.prisma`

```prisma
model NotaFiscal {
  id              String           @id @default(uuid())
  chaveAcesso     String           @unique // Chave de 44 dígitos da NF-e / NFC-e
  numero          String?
  serie           String?
  fornecedorNome  String           // Razão Social / Nome Fantasia do emitente
  fornecedorCnpj  String           // CNPJ ou CPF do emitente
  valorTotal      Float            // Valor total da nota (vNF / vProd)
  dataEmissao     DateTime         // Data/Hora de emissão (dhEmi)
  criadoEm        DateTime         @default(now())
  atualizadoEm    DateTime         @updatedAt

  itens           ItemNotaFiscal[]

  @@map("notas_fiscais")
}

model ItemNotaFiscal {
  id                   String      @id @default(uuid())
  notaFiscalId         String
  insumoId             String?     // Insumo vinculado no almoxarifado (opcional)
  descricaoOriginal    String      // xProd do XML
  unidadeOriginal      String      // uCom do XML (ex: CX, KG, UN)
  quantidadeOriginal   Float       // qCom do XML
  valorUnitario        Float       // vUnCom do XML
  valorTotal           Float       // vProd do XML
  quantidadeConvertida Float?      // Quantidade convertida para a unidade do insumo (ex: 5000g)
  criadoEm             DateTime    @default(now())

  notaFiscal           NotaFiscal  @relation(fields: [notaFiscalId], references: [id], onDelete: Cascade)
  insumo               Insumo?     @relation(fields: [insumoId], references: [id], onDelete: SetNull)

  @@map("itens_nota_fiscal")
}
```

E no model `Insumo`:
```prisma
model Insumo {
  // ... campos existentes
  itensNotaFiscal       ItemNotaFiscal[]
}
```

---

## [Auth/JWT] Modelo de Usuários e Autenticação (`Usuario`, `Role`) — [CONCLUÍDO]

- **Data:** 14/10/2026
- **Status:** **CONCLUÍDO** (Migration `add_usuarios_auth` aplicada e seed atualizado).
- **Módulo Solicitante:** Agente Backend / Frontend (Autenticação JWT e Perfil de Usuário)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
O sistema necessita de persistência real de contas de usuários, autenticação JWT com senhas criptografadas em bcrypt e controle de perfis de acesso (Admin, Gerente, Operador).

### Proposta no `backend/prisma/schema.prisma`

```prisma
enum Role {
  ADMIN
  GERENTE
  OPERADOR
}

model Usuario {
  id           String   @id @default(uuid())
  nome         String
  email        String   @unique
  senha        String   // Hash bcrypt
  telefone     String?
  role         Role     @default(OPERADOR)
  ativo        Boolean  @default(true)
  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  @@map("usuarios")
}
```

### Seed
Inserir usuário inicial de administração no `backend/prisma/seed.ts`:
- **Nome:** Carlos Eduardo
- **E-mail:** `gerente@burguerhouse.com.br`
- **Senha:** Hash bcrypt de `admin123`
- **Telefone:** `(67) 99876-5432`
- **Role:** `ADMIN`


---

## Pedido (BACK -> DB): externalId em Venda para deduplicar webhook — [CONCLUÍDO, com ressalvas]

- **Status:** coluna `Venda.externalId String? @unique`, extrator `extrairIdExterno` e tratamento de `P2002` implementados.
- **Correção (PR "estado do pedido"):** o webhook da Anota AI avisa MUDANÇAS DE ESTADO do mesmo pedido (aceito, atualizado, cancelado), todas com o mesmo ID. Descartar o evento repetido fazia valer o PRIMEIRO estado (um pedido cancelado continuava descontando estoque). Agora, enquanto a venda não foi consolidada, o evento mais recente substitui o payload; a consolidação só abate pedidos com `check` 1, 2 ou 3, descarta 4/5/-4/41/42 e deixa pendentes 0/-2/-1/-3/6.
- **AINDA NÃO CONFIRMADO:** o campo do ID do pedido e o formato do corpo do webhook vêm da documentação pública da Anota AI (`id`/`_id`, `check`, `items[]`, `subItems[]`) e de um extrator que tenta vários formatos. Falta validar com um **payload real** (ambiente de teste de 7 dias da Anota AI) antes de produção.

## Decisões pendentes do dono da loja (BACK)

- **Cancelamento DEPOIS da consolidação:** hoje não mexe no estoque (o pedido já foi abatido e a venda não é reescrita). Se o pedido foi só cancelado antes de preparar, o estoque deveria ser devolvido; se já foi preparado, o insumo foi desperdiçado e o certo é registrar uma perda. Definir a regra e, se for devolver, pedir ao DB um campo para saber que o estoque da venda já foi abatido (ex.: `Venda.estoqueAbatido`), para o estorno não acontecer duas vezes.
- **Cancelamento ANTES da consolidação:** o pedido é descartado sem abater. Se o cancelamento ocorreu depois de preparado (`check` 1 ou 2), o insumo gasto não foi contabilizado: o operador deve registrar como perda. Confirmar se isso é aceitável para a loja.
- **Pedido agendado (`check` -2) e em análise (0):** ficam pendentes até ser aceitos/entrarem em produção. Confirmar se a loja usa pedido agendado.
- **Modificadores e Adicionais no Anota AI (`subItems`):** hoje o `expandirItens` trata todo `subItem` como produto do catálogo para abatimento. No Anota AI real, `subItems` englobam tanto adicionais pagos ("Bacon Extra", "Hambúrguer 160g") quanto observações/modificadores de cozinha sem produto correspondente ("Sem cebola", "Ponto: ao ponto", "Molho à parte"). Quando um modificador não existe no catálogo de produtos, a venda fica retida em `vendasPendentesNaoMapeadas` (zero baixa silenciosa parcial). Decisão necessária: definir se adicionais pagos devem ter cadastro como produto com ficha técnica, e criar uma lista de ignorados/mapeados para observações de preparo quando obtivermos os primeiros payloads reais do ambiente de testes da Anota AI.

---

## Decisão (BACK): onde o código diverge do PLANO.md (registrado a pedido do dono)

- **Webhook (Fase 3)**: o plano diz "200 imediato, escreve depois (fire-and-forget)". O código grava ANTES de responder e devolve 500 se falhar (assim a Anota AI pode reenviar e nenhuma venda se perde em silêncio). Risco: se o Neon estiver acordando e a gravação passar de 5 s, a Anota AI pode contar como falha e reenviar -> precisa do `Venda.externalId` (pedido acima) para deduplicar. Mitigação já existente: ping de aquecimento às 17:50 (`.github/workflows/cron.yml`).
- **Segredo do webhook**: o plano diz "token da Anota AI, se existir". O código exige `ANOTAAI_WEBHOOK_SECRET` (header `x-webhook-secret` ou `?token=`) e devolve 503 se não estiver configurado. **Confirmar com a Anota AI** se ela permite enviar header/token; se não permitir, usar `?token=` na URL cadastrada (o parâmetro é redigido nos logs).
- **Consolidação**: autenticada por `CRON_SECRET` (header `x-cron-secret`), não por JWT, para o cron externo não depender de senha/token expirável. Estoque negativo é permitido na consolidação (a venda já aconteceu) e sinalizado na resposta; na produção interna bloqueia com 409; em perdas registra e sinaliza `estoqueNegativo`.
- **Dedup de nota fiscal sem schema**: a `chaveAcesso` (já `@unique`) é a chave de idempotência; a nota agora é gravada sempre que houver chave (CNPJ vazio se desconhecido). Nenhuma mudança de schema necessária.

## Pendências / pedidos para outros donos

- **DB (infra de deploy)**: configurar no GitHub os secrets `API_URL` (sem barra final) e `CRON_SECRET` e, por último, a variável `CRON_ATIVO=true` (o cron fica desligado até então, para não falhar todo dia útil sem API no ar); no Koyeb: `JWT_SECRET`, `ANOTAAI_WEBHOOK_SECRET`, `CRON_SECRET`, `CORS_ORIGINS` (URL da Vercel), `TRUST_PROXY=1` (confirmar o número de proxies do Koyeb); na Vercel: `VITE_API_URL`. O seed cria o admin com senha `admin123`: trocar a senha antes de usar em produção.
- **TESTES (backend/tests)**: os specs colocados em `src/` cobrem guard JWT/webhook/cron/erros (`app.spec.ts`), consolidação atômica, produção/perdas, SSRF (validação de URL/IP) e nota sem CNPJ. Faltam, de preferência com banco real: `Promise.all` de duas consolidações/produções reais (os specs atuais simulam a concorrência de forma determinística), SSRF com DNS rebinding e redirect real, e o cenário "loja fechada seg/ter, primeiro pedido na quarta 18h" (cold start).
- **BACK (próximos passos, fora deste PR)**: tratar modificadores/adicionais do payload na consolidação ("bacon extra" -> insumo bruto, Fase 3 do plano; depende de um payload real da Anota AI, `docs/dados_reais.json` não tem); ler a fundo as páginas do frontend não revisadas (Estoque, Dashboard, Perdas, Insumos, FichaTecnica, Inicio, modais); autorização por role (`authorize`) quando o produto definir quem pode o quê; depois do `externalId`, usar upsert/ignorar P2002 no webhook.

## Segurança do auth: pedidos abertos (resultado da revisão do módulo `auth`)

Poucos usuários usam o sistema, então a solução adotada foi a mais simples e segura:

- **DB: invalidar tokens ao trocar a senha ou desativar o usuário — [CONCLUÍDO]**
  - Migration `20261030142000_add_usuario_token_version` aplicada.
  - O JWT agora leva `tv: usuario.tokenVersion` com expiração de 12 horas.
  - O guard global consulta `ativo`, `role` e `tokenVersion` no banco a cada requisição: responde 401 se inativo ou se `tv` divergir (revogação instantânea de sessão).
  - A troca atômica de senha incrementa `tokenVersion`, invalidando sessões anteriores.

- **DB (seed): senha do admin — [CONCLUÍDO]**
  - `backend/prisma/seed.ts` atualizado: lê `SEED_ADMIN_PASSWORD` e recusa rodar sem ela caso `NODE_ENV=production`.
  - Em desenvolvimento sem a variável, emite aviso claro de segurança no console e usa fallback seguro para DX.
  - Criação migrada para `upsert` idempotente, evitando falhas ao rodar o seed mais de uma vez.
  - Variável documentada em `backend/.env.example`.
- **Decisão do dono da loja: matriz de permissões por role.** Nenhuma rota usa `role` hoje (qualquer usuário logado faz tudo). Definir quem pode o quê (ex.: OPERADOR registra perdas e preparo; só ADMIN altera insumos, fichas técnicas e notas fiscais). Com a matriz definida, o BACK implementa `exigirRole(...)` lendo o `role` do banco (junto da consulta acima) e um teste "OPERADOR recebe 403" por rota restrita.

---

## [Fase 3] Coluna / Índice Único sobre `nomeNormalizado` em `Produto` — [PENDENTE]

- **Data:** 03/11/2026
- **Status:** **PENDENTE**
- **Módulo Solicitante:** Backend (Fase 3 — Insumos, Produtos e Fichas Técnicas)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

### Motivo
Para evitar que produtos com grafias equivalentes (ex.: `"X-Bacon"`, `"X Bacon"`, `"x bacon"`, `"X_Bacon"`) sejam cadastrados em duplicidade — o que causaria divergência ou retenção silenciosa na consolidação de vendas da Anota AI —, o backend agora valida a normalização em tempo de execução via `normalizarNomeProduto(nome)` (`shared/nomes.ts`), bloqueando duplicidades com `409 Conflict`.
Para garantir atomicidade e proteção total contra concorrência estrita diretamente no motor do PostgreSQL (sem depender exclusivamente da validação em camada de aplicação), sugere-se a adição de uma coluna `nomeNormalizado` com índice único `@unique` no model `Produto`.

### Proposta no `backend/prisma/schema.prisma`
```prisma
model Produto {
  id              String         @id @default(uuid())
  nome            String
  nomeNormalizado String?        @unique // ou populado automaticamente via trigger / repository
  criadoEm        DateTime       @default(now())
  atualizadoEm    DateTime       @updatedAt

  fichasTecnicas  FichaTecnica[]
}
```

---

## [Fase 2 / Produto] Endpoint e Estrutura para Ajuste / Inventário de Estoque — [PENDENTE]

- **Data:** 09/11/2026
- **Status:** **PENDENTE** (Decisão de Produto / Dono da Loja e Agente de Banco de Dados)
- **Módulo Solicitante:** Backend (Fase 2 — Insumos e Fichas Técnicas)
- **Área Destino:** Dono da Loja e Agente de DB / Humano (`docs/PLANO.md` e `backend/prisma/schema.prisma`)

### Contexto e Motivo
No PR #54, o campo `estoqueAtual` foi removido do body aceito em `PUT /api/insumos/:id` e desabilitado no formulário de edição do frontend para blindar o saldo físico contra sobrescritas acidentais durante a alteração de dados cadastrais (nome, unidade, custos, etc.).

No entanto, no desenho atual do sistema:
1. As rotas que afetam saldo apenas reduzem o estoque (registro de perdas e consolidação de vendas da Anota AI) ou aumentam saldo bruto exclusivamente via importação de XML de Nota Fiscal (e benefício interno de subfichas).
2. Não existe endpoint para ajuste ou inventário de estoque.
3. Se um insumo for cadastrado inicialmente com saldo zero/incorreto por engano, ou houver divergência na contagem física periódica (balanço de almoxarifado/sobra real), o lojista fica sem mecanismo legítimo no sistema para retificar o saldo para cima sem precisar forjar uma Nota Fiscal.
4. O `docs/PLANO.md` (linha 46) lista "estoque atual" no CRUD de insumos, gerando divergência entre o escopo documentado e o comportamento de proteção estrita implementado.

### Proposta para Decisão do Dono da Loja / Produto
1. **Endpoint de Ajuste:** Criar rota `POST /api/insumos/:id/ajuste` com payload `{ novoSaldo: number, motivo: string }`.
2. **Rastreabilidade / Auditoria (Schema):**
   - **Opção A (Recomendada):** Criar um model `AjusteEstoque` no Prisma (campos: `id`, `insumoId`, `saldoAnterior`, `novoSaldo`, `diferenca`, `motivo`, `usuarioId`, `criadoEm`), garantindo trilha de auditoria contábil completa.
   - **Opção B:** Atualização direta em transação atômica no `Insumo` registrando log estruturado.

---

## [Fase 4 / Segurança Alimentar] Data de Fabricação / Lote para Validade de Item Beneficiado — [PENDENTE]

- **Data:** 09/11/2026
- **Status:** **PENDENTE** (Decisão de Produto / Vigilância Sanitária e Agente de Banco de Dados)
- **Módulo Solicitante:** Auditoria de Frontend & Segurança Alimentar (Fase 4 — Preparo Interno / Almoxarifado)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`) e Agente BACK (`backend/src/modules/preparo_interno/`)

### Contexto e Motivo (Achado A1 🔴)
Atualmente, tanto a interface de almoxarifado (`frontend/src/pages/Estoque.tsx:23`) quanto a agregação de alertas no backend (`backend/src/modules/dashboard/services/dashboard.service.ts:66`) calculam a data de vencimento de insumos produzidos internamente somando `validadeDias` ao campo `insumo.atualizadoEm`.

No entanto, no schema do Prisma (`backend/prisma/schema.prisma`), o campo `atualizadoEm` possui o modificador `@updatedAt`:
```prisma
model Insumo {
  ...
  atualizadoEm DateTime @updatedAt
}
```
Isso significa que **qualquer operação que atualize a linha do insumo** (como baixa de estoque por perda, decremento de estoque pela consolidação de vendas de um produto cuja ficha técnica consome o insumo beneficiado, ou edição cadastral de custo/nome) renova o timestamp de `atualizadoEm`.

**Impacto Sanitário Crítico:**
- Um lote de molho ou preparo caseiro produzido há 7 dias com validade de 3 dias (já impróprio para consumo) tem seu `atualizadoEm` atualizado para o horário da última venda realizada pelo caixa ou delivery.
- O sistema recalcula o vencimento a partir desse novo instante, fazendo o item vencido constar falsamente como "fresco / dentro da validade".
- **Risco sanitário:** alimento vencido exibido aos operadores e no dashboard como válido e seguro para consumo.

**Evidência reproduzida:**
Uma alteração de estoque (decremento de 10g) atualizou o `atualizadoEm` de 13:32:18 para 13:32:20, postergando o vencimento do lote físico.

### Proposta Técnica de Resolução

#### 1. Opção A (Recomendada / Rastreabilidade Completa por Lote):
- Criar entidade de lote de preparo (ex.: `LotePreparo` ou `HistoricoProducao`) com `id`, `insumoId`, `quantidadeProduzida`, `quantidadeRestante`, `produzidoEm DateTime @default(now())` e `validadeEm DateTime`.
- Permite gestão FIFO (*First In, First Out* — primeiro que vence, primeiro que sai) e controle fidedigno de cada fração física do estoque. Esta é a única abordagem capaz de discriminar exatamente qual quantidade vence em qual dia.

#### 2. Opção B (Mínima / Conservadora via `ultimoPreparoEm` no Insumo):
> **Atenção:** Atualizar `ultimoPreparoEm` a cada nova produção de forma ingênua causaria o mesmo efeito da A1 (uma sobra de 300g produzida na segunda e vencendo na quinta seria indevidamente "rejuvenescida" para sábado caso 200g novos fossem produzidos na quarta).

Para ser segura, a Opção B deve ser **estritamente conservadora ("errar sempre para o lado seguro")**:
- **Regra de gravação:** O campo `ultimoPreparoEm` só deve ser atualizado na produção se o saldo físico anterior for $\le 0$ (lote 100% novo). Enquanto houver sobra de lote anterior, preserva-se o `ultimoPreparoEm` mais antigo. Dessa forma, o sistema pode alertar "vencido" precocemente para o lote novo, mas **nunca** deixará uma sobra vencida passar como válida.
- **Tratamento de nulos:** Se `ultimoPreparoEm === null` (dados legados ou prévios à migração), o item deve ser classificado explicitamente como `"validade desconhecida"`, e nunca como "ok / sem alerta".

#### 3. Fonte Única da Verdade para o Cálculo (Eliminando Duplicação de Fórmulas):
- O backend deve devolver os campos de validade já calculados no payload de `GET /api/insumos` e nos alertas:
  ```json
  {
    "venceEm": "2026-11-12T14:00:00.000Z",
    "diasRestantes": 2,
    "statusValidade": "OK" // "OK" | "VENCENDO" | "VENCIDO" | "DESCONHECIDO"
  }
  ```
- O frontend apenas consome e renderiza os campos do contrato, eliminando a duplicação de fórmulas entre front e back (**Achado A5**).

---

## [Backend / Zod] Mensagens de Validação em Português (`z.locales.pt`) — [PENDENTE]

- **Data:** 09/11/2026
- **Status:** **PENDENTE** (Agente BACK / `backend/src/infra/http/`)
- **Módulo Solicitante:** Frontend (Achado A3)
- **Área Destino:** Agente BACK (`backend/src/infra/http/app.ts` ou validador Zod)

### Motivo
Atualmente o Zod emite mensagens padrão de erro em inglês (ex.: `Too small: expected number to be >=0`, `Invalid input: expected number, received string`). Embora o frontend agora prefixe amigavelmente o nome do campo identificado em `issues[0].path`, o texto da validação continua em inglês para o usuário final.

### Proposta
Ativar a localização pt-BR nativa do Zod no backend:
```ts
import { z } from 'zod';
z.config(z.locales.pt());
```

---

## [Auth / RBAC] Refinamento da Matriz de Permissões para Telas do Frontend — [PENDENTE]

- **Data:** 09/11/2026
- **Status:** **PENDENTE** (Decisão de Produto / Dono da Loja e Agente BACK)
- **Módulo Solicitante:** Revisão de Frontend & Segurança
- **Área Destino:** Dono da Loja e Agente BACK

### Contexto
Durante o detalhamento da matriz de permissões por role (`ADMIN`, `GERENTE`, `OPERADOR`), foram identificados três pontos críticos onde o bloqueio ingênuo de endpoints por role causaria tela de erro `403 Forbidden` no frontend:

1. **Dashboard Inicial (`Inicio.tsx:55`):**
   - A tela inicial do operador chama `GET /api/dashboard/resumo`.
   - Se `/api/dashboard/resumo` for restrito apenas a `GERENTE` e `ADMIN`, o operador receberá `403` imediatamente ao abrir a aplicação.
   - **Solução proposta:** Segregar os dados: liberar para todos os usuários logados o resumo operacional do turno (vendas do dia, itens em alerta), restringindo a `GERENTE`/`ADMIN` apenas as abas executivas e métricas financeiras completas (faturamento histórico, custos e compras por fornecedor).

2. **Preparo Interno vs. Fichas Técnicas:**
   - A rota `POST /api/preparo-interno/sub-fichas` edita a receita base do item beneficiado (equivalente à engenharia de cardápio de fichas técnicas).
   - Para manter consistência com as fichas técnicas de produtos (restritas exclusivamente a `ADMIN` na matriz), a criação e alteração de sub-fichas de preparo deve ser restrita a `ADMIN` (ou decidir se `GERENTE` também terá permissão de editar receitas na cozinha). O `OPERADOR` fica com acesso restrito estritamente ao registro da produção diária (`POST /api/preparo-interno/produzir`).

3. **Perdas e Visibilidade de Custo:**
   - A tela de perdas do operador consome `GET /api/perdas/resumo-mensal`, que computa valores financeiros em R$.
   - Definir se a loja permite que o operador visualize o valor financeiro das perdas ou se a resposta da rota deve omitir `valorTotal` quando o solicitante possuir perfil `OPERADOR`.

---

## [Backend / Produção] Normalização de fatorPerda Negativo em producao.service.ts — [RESOLVIDO]

- **Data:** 10/11/2026
- **Status:** **RESOLVIDO** (`fatorPerdaSeguro` em `backend/src/shared/fator_perda.ts` aplicado em `producao.service.ts` e `planejar_consolidacao.ts`).
- **Módulo Solicitante:** Frontend (Fase F3 — Preparo Interno)
- **Área Destino:** Agente BACK (`backend/src/modules/preparo_interno/services/producao.service.ts`)

### Motivo
Em `backend/src/modules/vendas/services/planejar_consolidacao.ts:197`, fatores de perda negativos são normalizados para zero:
`fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0)`.

Porém, em `backend/src/modules/preparo_interno/services/producao.service.ts:41`, o cálculo de consumo na produção interna utiliza o valor cru de `fatorPerda`:
`consumo = Number((ing.quantidadeNecessaria * (1 + ing.insumoBruto.fatorPerda) * quantidade).toFixed(4))`.

Caso um insumo esteja cadastrado com fator de perda negativo (por exemplo `-0.05` por erro de preenchimento ou migração), `(1 + fatorPerda)` fica menor que 1 (`0.95`), resultando em consumo *menor* que o teórico necessário para produzir o lote físico.

### Proposta
Padronizar `producao.service.ts` com a mesma guarda determinística de `planejar_consolidacao.ts`:
`const fatorPerda = Math.max(0, ing.insumoBruto.fatorPerda || 0);`

---

## [Contrato / Dashboard] Campos de validade em `estoqueAlerta` não documentados — [PENDENTE]

- **Data:** 10/11/2026
- **Status:** **PENDENTE** (Agente BACK / `docs/api.md`, seção `GET /api/dashboard/resumo`)
- **Módulo Solicitante:** Frontend (Início e Relatórios)
- **Área Destino:** Agente BACK (`docs/api.md`)

### Motivo
`backend/src/modules/dashboard/services/dashboard.service.ts:345-365` inclui em `estoqueAlerta` também o insumo que **vence em até 2 dias ou já venceu**, mesmo com estoque acima do mínimo, e nesse caso acrescenta `diasRestantesValidade` (número; negativo quando vencido) e `vencido` (boolean). O exemplo de `docs/api.md` mostra só `status` e `percentualEstoque`.

O frontend passou a depender desses campos: o Início e Relatórios mostram "Vence em 2 dias" / "Vencido" quando `diasRestantesValidade` vem preenchido, em vez de tratar o item como estoque baixo.

### Proposta
Documentar no exemplo de resposta de `GET /api/dashboard/resumo`:
- `diasRestantesValidade?: number` — presente só quando a validade é motivo do alerta (vencido ou vencendo em até 2 dias).
- `vencido?: boolean` — presente junto com `diasRestantesValidade`.
- Observação do F4 (11/11/2026): `vencido` é `diasRestantes <= 0` (`dashboard.service.ts:78`), então `diasRestantesValidade: 0` já é vencido. O front segue essa regra mesmo se `vencido` não vier, e trata `null` como ausente.

---

## [Contrato / Dashboard] Ajustes de `GET /api/dashboard/resumo` vistos no endurecimento F4 — [PENDENTE]

- **Data:** 11/11/2026
- **Status:** **PENDENTE** (Agente BACK / `backend/src/modules/dashboard/services/dashboard.service.ts` e `docs/api.md`)
- **Módulo Solicitante:** Frontend (Relatórios, `frontend/src/pages/Dashboard.tsx`)
- **Área Destino:** Agente BACK

O frontend já se protege dos três pontos abaixo; nada está quebrado na tela. São divergências entre o contrato e o código, ou ordenações que limitam o que a tela consegue mostrar.

### 1. `perdasPorMotivo` sempre traz os 4 motivos, zerados quando não houve perda
`dashboard.service.ts:197-236` inicializa `VENCIMENTO`, `ERRO_PREPARO`, `ESTRAGADO` e `OUTRO` com zero e devolve todos. O exemplo de `docs/api.md` mostra só os motivos com perda. Até o F4 a tela nunca mostrava "Nenhuma perda no período." e desenhava barra de 3% para motivo zerado; o front agora filtra `totalOcorrencias > 0 || valorTotal > 0`.
**Proposta:** decidir e documentar: ou filtrar os zerados no backend, ou registrar no `docs/api.md` que os 4 motivos vêm sempre.

### 2. `consumoInsumos` é o top 10 por `quantidadeConsumida`, somando unidades diferentes
`dashboard.service.ts:330-339` ordena por quantidade e corta em 10. Comparar 48.000 g com 300 unidades não diz o que mais pesa; a seção da tela é "O que a cozinha mais consumiu — custo estimado" e reordena por `valorEstimado`, mas só enxerga os 10 de maior quantidade (um insumo caro em poucas unidades pode ficar de fora).
**Proposta:** ordenar por `valorEstimado` antes do `slice(0, 10)` (ou aceitar um parâmetro de ordenação) e documentar o critério.

### 3. Insumo com `estoqueMinimo = 0` e estoque zerado entra em `estoqueAlerta` como `CRITICO` com `percentualEstoque: 100`
O filtro `estoqueAtual <= estoqueMinimo * 1.25` (`dashboard.service.ts:345`) vale para `0 <= 0`, e o percentual vira 100 quando o mínimo é 0 (`:351-353`). Insumos sem mínimo cadastrado aparecem como críticos e o "100% do mínimo" engana. O front agora mostra "Sem estoque" quando `estoqueAtual <= 0`, mas a contagem continua inflada.
**Proposta:** decidir com o dono se insumo sem mínimo deve gerar alerta; se não, excluir `estoqueMinimo <= 0` do filtro de estoque (a validade continua valendo) e documentar.

---

## [Notas Fiscais] Data de emissão inventada ou aceita sem validação — [RESOLVIDO]

- **Data:** 11/11/2026
- **Status:** **RESOLVIDO** (`xml_parser.service.ts` omite `dataEmissao` ausente/inválida; `notas_fiscais.controller.ts` valida ISO 8601 no `confirmar` e `entrada_estoque.service.ts` rejeita data inválida).
- **Módulo Solicitante:** Frontend (F6 — `ImportarNotaFiscal.tsx`)
- **Área Destino:** Agente BACK (+ `docs/api.md` §8)

### Motivo
1. `xml_parser.service.ts:486` usa `ide.dhEmi || ide.dEmi || new Date().toISOString()`: um XML sem data de emissão volta com a data de hoje, sem nenhum sinal. O frontend mostra essa data como se fosse a da nota. O QR code já sinaliza a aproximação (`dataEmissaoAproximada`), o XML não.
2. `confirmarEntradaSchema` aceita `dataEmissao: z.string()` qualquer, e `entrada_estoque.service.ts:104-118` troca uma data inválida pela de hoje em silêncio. O frontend (F6) passou a só enviar ISO 8601 válida e omitir o campo quando falta, mas outro cliente pode gravar a data errada sem erro.

### Proposta
- Parser de XML: sem `dhEmi`/`dEmi`, devolver `dataEmissao` ausente (ou a data de hoje com `dataEmissaoAproximada: true`), e documentar o campo também na resposta de `POST /parser-xml`.
- `confirmar`: validar `dataEmissao` como ISO 8601 (`z.string().datetime({ offset: true })` ou só data `YYYY-MM-DD`) e responder 400 quando inválida, em vez de trocar pela data de hoje.
