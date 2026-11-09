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



