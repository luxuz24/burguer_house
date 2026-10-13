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
