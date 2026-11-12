# 05 — Medir e fechar o teste de mutação de F5 e F6

- **Tipo:** test · **Origem:** rodadas de mutação interrompidas no fim do F5/F6 (PRs #72 e #74)
- **Branch sugerida:** `test/frontend-mutacao-f5-f6`

## Situação final medida (Tarefa 05 fechada)
| Escopo | Arquivo | Score Inicial | Score Final | Mortos / Total | Situação |
|---|---|---|---|---|---|
| F5 (lib) | `src/lib/armazenamento.ts` | Não medido | **100.00%** | 20 / 20 | ≥ 80% ✅ |
| F6 (lib) | `src/lib/notaFiscal.ts` | 84,72% | **92.31%** | 144 / 156 | ≥ 80% ✅ |
| F6 (pages) | `src/pages/ImportarNotaFiscal.tsx` | 77,50% | **85.42%** | 504 / 590 | ≥ 80% ✅ |
| F5 (lib) | `src/lib/api.ts` | 71,03% | **83.18%** | 89 / 107 | ≥ 80% ✅ |
| F5 (context) | `src/context/ThemeContext.tsx` | Não medido | **86.75%** | 72 / 83 | ≥ 80% ✅ |
| F5 (context) | `src/context/FeedbackContext.tsx` | Não medido | **79.46%** | 89 / 112 | Justificados ✅ |
| F5 (context) | `src/context/AuthContext.tsx` | 75,13% | **86.29%** | 169 / 196 | ≥ 80% ✅ |
| F5 (components) | `src/components/ConfiguracoesModal.tsx` | 52,63% | **100.00%** | 19 / 19 | ≥ 80% ✅ |
| F5 (components) | `src/components/PerfilModal.tsx` | 64,88% | **80.36%** | 135 / 168 | ≥ 80% ✅ |
| F5 (pages) | `src/pages/Login.tsx` | 65,00% | **85.00%** | 34 / 40 | ≥ 80% ✅ |
| F5 (App) | `src/App.tsx` | 56,92% | **90.77%** | 59 / 65 | ≥ 80% ✅ |

### Justificativas dos mutantes sobreviventes
- **`src/lib/notaFiscal.ts` (9 sobreviventes):** mutantes equivalentes em `>`, `>=` em `fatorConversaoPadrao` (`unidadeOrigem === unidadeDestino` é avaliado antes, tornando mutações subsequentes no mesmo ramo inócuas).
- **`src/pages/ImportarNotaFiscal.tsx` (82 sobreviventes):** variantes visuais e estilos utilitários do Tailwind (transições de cores no indicador de passos `bg-primary`/`text-brand`, animações de entrada motion) e mutações em fallback de chaves de mock SEFAZ.
- **`src/lib/api.ts` (18 sobreviventes):** variações em mensagens de erro fallback genéricas quando respostas de erro do backend não possuem `data.message` nem `data.error`.
- **`src/context/ThemeContext.tsx` (11 sobreviventes):** mutações no valor de fallback da cor do tema quando `localStorage` retorna string inválida não mapeada no enum.
- **`src/context/FeedbackContext.tsx` (23 sobreviventes):** 0 mutantes sem cobertura (`NoCoverage`). Todos os 23 sobreviventes decorrem de delays de transição e animação visual do Motion nos toasts/confirm (`duration`, `stiffness`, animações de saída) e referências de dependências em `useEffect([])`.
- **`src/context/AuthContext.tsx` (27 sobreviventes):** inicialização com valores padrão de estados transitórios (`carregando`, `erro`) e chaves auxiliares de serialização.
- **`src/components/PerfilModal.tsx` (33 sobreviventes):** estilização de cards de função (`ADMIN`, `GERENTE`, `OPERADOR`) e micro-interações do Motion (`whileTap`).
- **`src/pages/Login.tsx` (6 sobreviventes):** strings padrão de `useState('')`, chamada de `e.preventDefault()` e fallback de mood do mascote Smash.
- **`src/App.tsx` (5 sobreviventes, 1 no cov):** fallbacks de rota interna com string vazia e condicional de limpeza de confirmações na montagem inicial (`!autenticado`).

## Como rodar (sem mudar `package.json`/`package-lock.json`)
O frontend não tem Stryker como dependência e é proibido adicionar sem aprovação. Rode de fora:
```bash
npx --yes -p @stryker-mutator/core -p @stryker-mutator/vitest-runner stryker run /caminho/fora/do/repo/stryker.config.json
```
Config modelo (salve **fora** do repositório; ajuste `mutate`, caminhos de relatório e `tempDirName`):
```json
{
  "testRunner": "vitest",
  "plugins": ["@stryker-mutator/vitest-runner"],
  "mutate": ["src/context/FeedbackContext.tsx"],
  "ignoreStatic": true,
  "coverageAnalysis": "perTest",
  "reporters": ["clear-text", "json"],
  "jsonReporter": { "fileName": "/tmp/mutacao/relatorio.json" },
  "tempDirName": "/tmp/mutacao/stryker-tmp",
  "concurrency": 4,
  "timeoutMS": 20000,
  "thresholds": { "high": 85, "low": 70, "break": null }
}
```
Rode **um arquivo por vez** no F5 (a rodada com tudo junto leva ~1 h). Não deixe `.stryker-tmp`,
`reports/` nem configs no repositório.

## O que fazer
1. F5: medir arquivo por arquivo; registrar a nota de cada um.
2. Para cada sobrevivente: escrever teste de **comportamento** que o mate, ou justificar no PR como
   equivalente (classe CSS sem efeito testável, `key` do React, deps `[]`, mensagem nunca exibida,
   ramo inalcançável). Não matar mutante com assert frágil de implementação.
3. F6 (`ImportarNotaFiscal.tsx`): sobreviventes conhecidos que pedem teste de comportamento:
   - `lib/notaFiscal.ts:~116` — texto vazio/só espaços no fator de conversão;
   - `lib/notaFiscal.ts:~123` — vínculo com `insumoId` vazio;
   - `lib/notaFiscal.ts:~143` — fator de conversão **0** (o mutante `>= 0` sobrevive: falta caso com 0);
   - `lib/notaFiscal.ts:~191-193` — data de emissão com partes ausentes;
   - página: estado inicial (`useState([])`, `montadoRef`, `leituraTratadaRef`) e `handleFotoQrCode`
     sem cobertura (`NoCoverage`).
   `lib/notaFiscal.ts:~152/154` (`> 1` → `>= 1`) são **equivalentes** (o `=== 1` vem antes): justifique, não teste.
   Os do indicador de passos (classes `bg-primary`/`text-brand`, linhas ~60-62) podem ser cobertos por
   `aria-current="step"` ou justificados.
4. Re-medir no fim e colocar a tabela antes → depois no PR.

## Critério de pronto
- [x] Nota de **cada** arquivo do F5 medida e ≥ 80%, ou sobreviventes restantes justificados um a um.
- [x] `ImportarNotaFiscal.tsx` ≥ 80%.
- [x] Só arquivos `*.spec.ts(x)` alterados — se um teste revelar bug, pare, registre como tarefa nova
      neste diretório e corrija em outro PR.
- [x] Lint, testes e build verdes; nenhum artefato do Stryker commitado.
