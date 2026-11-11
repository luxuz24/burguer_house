# 08 — Remover a dependência `recharts` (BLOQUEADA)

- **Tipo:** chore · **Estado:** **BLOQUEADA** até o dono aprovar mudança de dependência
  (`AGENTS.md`: não mexer em dependências sem pedir)
- **Arquivos:** `frontend/package.json` (linha ~20), `frontend/package-lock.json`
- **Branch sugerida:** `chore/frontend-remover-recharts`

## Contexto
Depois da migração visual (PRs #66–#70) nenhuma tela importa `recharts`; os gráficos viraram
barras/cartões próprios. A dependência só pesa na instalação.

## Antes de começar
1. Confirme a aprovação do dono no PR/issue. Sem ela, não faça nada.
2. Confirme que ninguém usa: `grep -rn "recharts" frontend/src` deve voltar vazio e
   `graphify query "recharts" --budget 500` não deve apontar código.

## O que fazer
`npm --prefix frontend uninstall recharts` (atualiza `package.json` e `package-lock.json` juntos) e
corrija `docs/STATUS.md` (1.7 cita `recharts` como biblioteca de gráficos).

## Critério de pronto
- [ ] Aprovação registrada.
- [ ] Lint, testes e build verdes; tamanho do bundle antes → depois no PR (`vite build`).
- [ ] Nenhuma outra dependência alterada no lock (confira o diff).
