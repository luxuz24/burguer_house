# 02 — Switch "Som e vibração no QR code" com alvo de toque de 28px

- **Tipo:** fix (acessibilidade) · **Origem:** endurecimento F5 (PR #72), achado registrado
- **Arquivo:** `frontend/src/components/ConfiguracoesModal.tsx` (switch em ~73-80)
- **Branch sugerida:** `fix/frontend-switch-som-alvo`

## Contexto
O checklist do `docs/PLANO_FRONTEND.md` exige alvo de toque de no mínimo 44×44px. A tela é usada no
celular, na cozinha, muitas vezes com a mão ocupada.

## Problema
O botão `role="switch"` tem `w-12 h-7` (48×28px). A altura de 28px fica abaixo do mínimo e o toque
perto da borda erra o controle.

## Comportamento esperado
- A área clicável do switch tem pelo menos 44px de altura e de largura, **sem** mudar o desenho
  visual do trilho (48×28) do esboço `docs/design/telas.html`. Caminho comum: o `<button>` ganha
  `min-h-[44px] min-w-[44px]` (convenção do F4) e o trilho vira um elemento interno; ou a linha inteira
  (texto + switch) vira o alvo, mantendo **um** só controle com `role="switch"` e `aria-checked`.
- Teclado: `Tab` chega ao switch, `Espaço`/`Enter` alternam, foco visível.
- Modo escuro com o mesmo contraste de hoje.

## Teste que deve falhar antes
Em `frontend/src/components/PerfilConfiguracoes.spec.tsx`, siga o padrão dos testes de 44px do F4
(`Inicio.spec.tsx:99-110`, que conferem `className` contendo `min-h-[44px]`):
- o elemento com `role="switch"` tem `min-h-[44px]` e `min-w-[44px]` (mesma convenção). Hoje falha.
- clicar no switch continua alternando `aria-checked` (regressão).

## Critério de pronto
- [x] Teste falhando antes e passando depois (saída no PR).
- [x] Conferido no navegador (claro e escuro, largura 375px) com captura no PR.
- [x] Lint, testes e build verdes.

## Fora do escopo
A leitura da preferência com storage bloqueado (tarefa 01). Se fizer as duas, use dois commits.
