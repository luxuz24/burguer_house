# 03 — Data de emissão da nota inventada ou aceita sem validação

- **Tipo:** fix · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "[Notas Fiscais] Data de emissão inventada ou aceita sem validação" (F6, 11/11/2026)
- **Arquivos:** `backend/src/modules/notas_fiscais/services/xml_parser.service.ts` (~486),
  `backend/src/infra/http/controllers/notas_fiscais.controller.ts` (~28, `confirmarEntradaSchema`),
  `backend/src/modules/notas_fiscais/services/entrada_estoque.service.ts` (~104-118), specs dos três,
  `docs/api.md` §8 (`POST /api/notas-fiscais/parser-xml` e `POST /api/notas-fiscais/confirmar`)
- **Branch sugerida:** `fix/backend-nf-data-emissao`

## Problema
1. **Parser:** `const dataEmissao = ide.dhEmi || ide.dEmi || new Date().toISOString();` — XML sem data
   volta com a data de **hoje**, sem sinal. O QR code já devolve `dataEmissaoAproximada`; o XML não.
2. **Confirmação:** o schema aceita `dataEmissao: z.string().optional()` qualquer, e
   `entrada_estoque.service.ts:104-118` troca data inválida pela de hoje em silêncio
   (`isNaN(...) ? new Date() : ...`). Um cliente que mande `"31/02/2026"` grava a data errada sem erro.

## Comportamento esperado
- Parser: sem `dhEmi`/`dEmi` (ou com valor inválido), **omitir** `dataEmissao` na resposta (preferido)
  ou devolver hoje com `dataEmissaoAproximada: true`. Escolha uma e documente.
- `confirmar`: `dataEmissao` opcional; se vier, precisa ser ISO 8601 válida (data `YYYY-MM-DD` ou
  data-hora com offset, ex.: `z.iso.datetime({ offset: true })` / `z.iso.date()` no Zod 4) → senão **400**.
- Sem `dataEmissao` no corpo: o serviço grava a data de hoje **explicitamente** (é o comportamento
  documentado), sem o fallback silencioso para data inválida.
- O frontend (F6) já só envia ISO válida e omite quando falta: confira `frontend/src/lib/notaFiscal.ts`
  para não quebrar o par.

## Teste que deve falhar antes
- `xml_parser.service.spec.ts`: XML sem `dhEmi`/`dEmi` → resposta **sem** `dataEmissao` (ou com
  `dataEmissaoAproximada: true`). Hoje vem a data de hoje.
- Spec HTTP de `confirmar`: `dataEmissao: "31/02/2026"` → **400** com `issues`. Hoje 2xx.
- `dataEmissao: "2026-11-10T14:30:00-04:00"` → gravada exatamente (regressão); ausente → hoje.

## Critério de pronto
- [ ] Testes falhando antes (saída no PR) e passando depois.
- [ ] `docs/api.md` §8 atualizado (campo opcional na resposta do parser, 400 na confirmação).
- [ ] Mutação ≥ 85% em `entrada_estoque.service.ts`.
- [ ] Entrada do `requests.md` marcada RESOLVIDO.

## Fora do escopo
Fuso de exibição (é do frontend) e reprocessar notas já gravadas.
