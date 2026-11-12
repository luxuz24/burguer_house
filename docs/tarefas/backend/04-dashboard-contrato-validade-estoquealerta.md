# 04 — Documentar os campos de validade em `estoqueAlerta`

- **Tipo:** docs (contrato) · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "[Contrato / Dashboard] Campos de validade em `estoqueAlerta` não documentados" (10/11/2026)
- **Arquivos:** `docs/api.md` (`GET /api/dashboard/resumo`, ~linha 724),
  `backend/src/modules/dashboard/services/dashboard.service.ts` (só leitura: `avaliarValidadeInsumo` ~63-80,
  filtro e montagem ~345-365)
- **Branch sugerida:** `docs/backend-contrato-estoquealerta`

## Problema
O serviço inclui em `estoqueAlerta` também o insumo que **vence em até 2 dias ou já venceu**, mesmo com
estoque acima do mínimo, e acrescenta `diasRestantesValidade` (número, negativo quando vencido) e
`vencido` (boolean). O exemplo do contrato só mostra `status` e `percentualEstoque`. O Início e
Relatórios do frontend já dependem desses campos.

## O que documentar (confira cada ponto no código antes de escrever)
- Quando o item entra na lista: estoque `<= estoqueMinimo * 1.25` **ou** validade vencida/≤ 2 dias.
- `diasRestantesValidade?: number` — presente só quando a validade é motivo do alerta.
- `vencido?: boolean` — junto com o anterior; `vencido` é `diasRestantes <= 0`, então **0 já é vencido**.
- `status: "CRITICO"` também quando vencido (`isCritico` considera `val?.vencido`).
- A validade conta a partir de `Insumo.atualizadoEm` (limitação conhecida, ver tarefa 15).

## Teste
Docs only — mas acrescente (ou confirme que existe) em `dashboard.service.spec.ts` um teste que trava o
formato: insumo com estoque folgado e vencendo em 1 dia aparece com `diasRestantesValidade: 1`,
`vencido: false`; com 0 dias, `vencido: true`. Se o teste já existir, cite-o no PR.

## Critério de pronto
- [ ] Exemplo e tabela de campos de `docs/api.md` atualizados.
- [ ] Teste de formato citado ou criado.
- [ ] Entrada do `requests.md` marcada RESOLVIDO.

## Fora do escopo
Mudar a regra de validade (tarefa 15) ou o tratamento de mínimo 0 (tarefa 07).
