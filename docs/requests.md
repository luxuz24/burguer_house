# Solicitações de Mudanças e Schema (Requests)

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

## Pedido (BACK -> DB): externalId em Venda para deduplicar webhook

- Webhook agora grava antes de responder e devolve 500 em falha, para o Anota AI reenviar. Sem deduplicacao, um reenvio apos 200 perdido duplica a venda.
- Pedido: coluna Venda.externalId String? @unique (ID do pedido no Anota AI) + migration.
- Pendente: confirmar com um payload real do Anota AI qual campo traz o ID do pedido (docs/dados_reais.json NAO contem payloads do webhook; so dados de insumos/metricas).
- Backend passara a usar upsert/ignorar P2002 quando o campo existir.

---

## Decisão (BACK): onde o código diverge do PLANO.md (registrado a pedido do dono)

- **Webhook (Fase 3)**: o plano diz "200 imediato, escreve depois (fire-and-forget)". O código grava ANTES de responder e devolve 500 se falhar (assim a Anota AI pode reenviar e nenhuma venda se perde em silêncio). Risco: se o Neon estiver acordando e a gravação passar de 5 s, a Anota AI pode contar como falha e reenviar -> precisa do `Venda.externalId` (pedido acima) para deduplicar. Mitigação já existente: ping de aquecimento às 17:50 (`.github/workflows/cron.yml`).
- **Segredo do webhook**: o plano diz "token da Anota AI, se existir". O código exige `ANOTAAI_WEBHOOK_SECRET` (header `x-webhook-secret` ou `?token=`) e devolve 503 se não estiver configurado. **Confirmar com a Anota AI** se ela permite enviar header/token; se não permitir, usar `?token=` na URL cadastrada (o parâmetro é redigido nos logs).
- **Consolidação**: autenticada por `CRON_SECRET` (header `x-cron-secret`), não por JWT, para o cron externo não depender de senha/token expirável. Estoque negativo é permitido na consolidação (a venda já aconteceu) e sinalizado na resposta; na produção interna bloqueia com 409; em perdas registra e sinaliza `estoqueNegativo`.
- **Dedup de nota fiscal sem schema**: a `chaveAcesso` (já `@unique`) é a chave de idempotência; a nota agora é gravada sempre que houver chave (CNPJ vazio se desconhecido). Nenhuma mudança de schema necessária.

## Pendências / pedidos para outros donos

- **DB (infra de deploy)**: configurar no GitHub os secrets `API_URL` (sem barra final) e `CRON_SECRET` e, por último, a variável `CRON_ATIVO=true` (o cron fica desligado até então, para não falhar todo dia útil sem API no ar); no Koyeb: `JWT_SECRET`, `ANOTAAI_WEBHOOK_SECRET`, `CRON_SECRET`, `CORS_ORIGINS` (URL da Vercel), `TRUST_PROXY=true`; na Vercel: `VITE_API_URL`. O seed cria o admin com senha `admin123`: trocar a senha antes de usar em produção.
- **TESTES (backend/tests)**: os specs colocados em `src/` cobrem guard JWT/webhook/cron/erros (`app.spec.ts`), consolidação atômica, produção/perdas, SSRF (validação de URL/IP) e nota sem CNPJ. Faltam, de preferência com banco real: `Promise.all` de duas consolidações/produções reais (os specs atuais simulam a concorrência de forma determinística), SSRF com DNS rebinding e redirect real, e o cenário "loja fechada seg/ter, primeiro pedido na quarta 18h" (cold start).
- **BACK (próximos passos, fora deste PR)**: tratar modificadores/adicionais do payload na consolidação ("bacon extra" -> insumo bruto, Fase 3 do plano; depende de um payload real da Anota AI, `docs/dados_reais.json` não tem); ler a fundo as páginas do frontend não revisadas (Estoque, Dashboard, Perdas, Insumos, FichaTecnica, Inicio, modais); autorização por role (`authorize`) quando o produto definir quem pode o quê; depois do `externalId`, usar upsert/ignorar P2002 no webhook.
