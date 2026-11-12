# 15 — Validade dos beneficiados conta da última edição, não do lote produzido (achado A1)

- **Tipo:** feat (segurança alimentar) · **Estado:** BLOQUEADA — decisão do dono e schema (agente DB)
- **Origem:** `docs/requests.md` → "[Fase 4 / Segurança Alimentar] Data de Fabricação / Lote para
  Validade de Item Beneficiado"; `docs/STATUS.md` 1.5 ("Validade em dias com alerta" 🟡);
  `docs/PLANO_FRONTEND.md` (decisão A1)
- **Arquivos:** `backend/src/modules/dashboard/services/dashboard.service.ts` (`avaliarValidadeInsumo` ~63-80),
  `backend/src/modules/preparo_interno/services/producao.service.ts`, `docs/api.md`

## Problema
`avaliarValidadeInsumo` usa `Insumo.atualizadoEm + validadeDias`. `atualizadoEm` é `@updatedAt`: **qualquer**
alteração do insumo (nome, custo, uma perda, uma venda abatida) zera a contagem. Uma maionese produzida
há 5 dias, com validade de 3, aparece "vence em 3 dias" se alguém editou o cadastro hoje. Risco
sanitário direto.

## Decisão pendente
- **Simples:** campo `Insumo.produzidoEm` atualizado só pela produção interna (vale o lote mais recente).
- **Completa:** model `LoteProducao` (quantidade, produzidoEm, venceEm, saldo) com consumo FIFO — ver
  "[Fase 4/7] Rastreamento Multi-Lote de Produção" no `requests.md`.

## Comportamento esperado (opção simples, depois do schema)
- `producao.service.ts` grava `produzidoEm = agora` na mesma transação da produção.
- `avaliarValidadeInsumo` usa `produzidoEm` (fallback documentado para insumos nunca produzidos).
- Editar o cadastro **não** mexe na validade.

## Teste que deve falhar antes
- Produzir em D0 com validade 3; editar o nome em D2; em D4 → `vencido: true`. Hoje "vence em 3 dias".
- Produzir de novo em D4 → validade volta a contar de D4.

## Critério de pronto
- [ ] Decisão e migration (dono do schema) registradas.
- [ ] Testes falhando antes e passando depois (fake timers).
- [ ] `docs/api.md`, `docs/STATUS.md` 1.5 e a tarefa 04 coerentes com a regra nova.
