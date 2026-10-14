# Solicitações de Mudanças e Schema (Requests)

## [Fase 4] Novas Tabelas e Campos para Perdas e Preparo Interno — [CONCLUÍDO]

- **Data:** 13/10/2026
- **Status:** **CONCLUÍDO** (Migration `add_perdas_e_preparo_interno` já aplicada na `main`).
- **Módulo Solicitante:** Backend (Fase 4 — Preparo Interno e Registro de Perdas)
- **Área Destino:** Agente de Banco de Dados / Humano (`backend/prisma/schema.prisma`)

Modelos `Perda`, `SubFichaTecnica`, enum `MotivoPerda` e campos `produzidoInternamente`, `validadeDias` no `Insumo` foram criados e estão ativos.

---

## [Fase 4/6] Adição de `custoUnitario` no Model `Insumo` — [PENDENTE]

- **Data:** 13/10/2026
- **Status:** **PENDENTE**
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

## [Fase 5] Tabelas para Notas Fiscais e Itens Comprados (`NotaFiscal`, `ItemNotaFiscal`) — [PENDENTE]

- **Data:** 14/10/2026
- **Status:** **PENDENTE**
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
