# 05 — Medir e fechar o teste de mutação de F5 e F6

- **Tipo:** test · **Origem:** rodadas de mutação interrompidas no fim do F5/F6 (PRs #72 e #74)
- **Branch sugerida:** `test/frontend-mutacao-f5-f6`

## Situação final medida (Tarefa 05 fechada)
| Escopo | Arquivo | Score Inicial | Score Final | Mortos / Total | Situação |
|---|---|---|---|---|---|
| F4 (histórico) | `src/pages/Inicio.tsx` | 93,12% | 93,12% | — | ≥ 80% ✅ |
| F4 (histórico) | `src/pages/Dashboard.tsx` | ≥ 80% | ≥ 80% | — | ≥ 80% ✅ |
| F4 (histórico) | `src/pages/alertasEstoque.ts` | 100% | 100% | 5 / 5 | ≥ 80% ✅ |
| F4 (histórico) | `src/pages/periodoPersonalizado.ts` | 100% | 100% | 7 / 7 | ≥ 80% ✅ |
| F5 (lib) | `src/lib/armazenamento.ts` | Não medido | **100.00%** | 20 / 20 | ≥ 80% ✅ |
| F5 (lib) | `src/lib/api.ts` | 71,03% | **83.18%** | 89 / 107 | ≥ 80% ✅ |
| F5 (context) | `src/context/ThemeContext.tsx` | Não medido | **86.75%** | 72 / 83 | ≥ 80% ✅ |
| F5 (context) | `src/context/FeedbackContext.tsx` | Não medido | **79.46%** | 89 / 112 | Justificados ✅ |
| F5 (context) | `src/context/AuthContext.tsx` | 75,13% | **86.29%** | 169 / 196 | ≥ 80% ✅ |
| F5 (components) | `src/components/ConfiguracoesModal.tsx` | 52,63% | **100.00%** | 19 / 19 | ≥ 80% ✅ |
| F5 (components) | `src/components/PerfilModal.tsx` | 64,88% | **80.36%** | 135 / 168 | ≥ 80% ✅ |
| F5 (pages) | `src/pages/Login.tsx` | 65,00% | **85.00%** | 34 / 40 | ≥ 80% ✅ |
| F5 (App) | `src/App.tsx` | 56,92% | **93.85%** | 61 / 65 | ≥ 80% ✅ |
| F6 (lib) | `src/lib/notaFiscal.ts` | 84,72% | **92.31%** | 144 / 156 | ≥ 80% ✅ |
| F6 (lib) | `src/lib/qrImagem.ts` | Não medido | **78.79%** | 52 / 66 | Justificados ✅ |
| F6 (lib combinada) | `notaFiscal.ts` + `qrImagem.ts` | 84,72% | **88.29%** | 196 / 222 | ≥ 80% ✅ |
| F6 (pages) | `src/pages/ImportarNotaFiscal.tsx` | 77,50% | **85.42%** | 504 / 590 | ≥ 80% ✅ |

### Justificativas dos mutantes sobreviventes detalhadas por arquivo

- **`src/App.tsx` (4 sobreviventes, 0 sem cobertura):**
  - `L25: if (!autenticado)` → `if (true)`: limpeza de confirmações ao encerrar sessão que roda idempotentemente na montagem.
  - `L50 e L57: modalAberto === 'importarNota' ? ... : 'none'`: troca de `'none'` por string vazia `""` (qualquer valor diferente de `'importarNota'` mantém o modal fechado).
  - `L73: {activeTab === 'inicio' && ...}` → `{true && ...}`: a aba inicial padrão do shell já é `'inicio'`.
  - O mutante anterior na `L97` (`onFechar={() => setMostrarPerfil(false)}`) e a falta de cobertura foram eliminados com o novo teste de fechamento direto do modal de Perfil.

- **`src/context/FeedbackContext.tsx` (23 sobreviventes, 0 sem cobertura):**
  - **Motion/Animações (5 mutantes - L172 a L175):** propriedades de entrada/saída do Motion (`initial`, `animate`, `exit`, `transition duration: 0.2`) em toasts; o teste em jsdom valida a presença e remoção do nó no DOM e suporte a `reducedMotion`, mas variações de easing/duração não alteram o markup final.
  - **Dependências de hooks React (8 mutantes - L84, L96, L106, L115, L128, L134, L145, L150):** mutações no array de dependências de `useCallback`, `useMemo` e `useEffect([])` onde os callbacks usam referências estáveis (`useRef`) ou referências de estado estáveis. O teste `desmontar o provider cancela os timers pendentes dos toasts` e os testes de estabilidade comprovam a ausência de vazamento de timers ou loops.
  - **IDs de controle (2 mutantes - L88, L100):** mutação de `++proximoId.current` para `--proximoId.current`, onde o valor numérico ser positivo ou negativo não quebra a unicidade de chave nem o identificador de fila.
  - **Fallbacks e limpezas defensivas (6 mutantes - L91, L112, L124, L126, L132, L210):** `.clear()` em Maps/Sets após iteração que já limpou/cancelou todos os elementos, e `confirmVariant="primary"` vs `""` (o componente `ConfirmDialog` internamente usa fallback para `'bg-primary'` quando a variante não é `'danger'`).
  - **Duração do Toast de erro (2 mutantes - L93):** `tipo === 'erro' ? 5000 : 3500`.

- **`src/lib/qrImagem.ts` (14 sobreviventes):**
  - `L41`: mensagem de rejeição padrão no `reject(new Error(...))` quando a imagem falha ao carregar (o erro de nível superior captura a exceção e lança a mensagem padrão amigável).
  - `L52`: condicionais de verificação do suporte do browser a `BarcodeDetector` e `createImageBitmap`.
  - `L57 e L58`: optional chainings defensivos `bitmap.close?.()` e `c.rawValue?.trim()`.
  - Combinado com `notaFiscal.ts`, o módulo de NFC-e do F6 atinge **88.29%** (196/222 mortos).

- **`src/lib/notaFiscal.ts` (9 sobreviventes):**
  - Mutações equivalentes em operadores de comparação `>`, `>=` em `fatorConversaoPadrao`: como `unidadeOrigem === unidadeDestino` é validado estritamente na primeira cláusula com retorno `1`, ramos derivados subsequentes para a mesma unidade tornam-se inalcançáveis/equivalentes.

- **`src/pages/ImportarNotaFiscal.tsx` (82 sobreviventes):**
  - Transições e classes de estilo no indicador de etapas (`Passos`): cores `bg-primary` / `text-brand` / `text-muted` nas linhas 55-65.
  - Variações nas micro-interações do framer-motion (`whileTap`, transições de opacidade).
  - Fallbacks nos campos auxiliares do mock SEFAZ (número de série, protocolo de autorização).

- **`src/lib/api.ts` (18 sobreviventes):**
  - Variações de formatação em strings genéricas de fallback (`'Falha na requisição'`, `'Erro inesperado'`) acionadas quando a resposta HTTP do backend não inclui `data.message`, `data.error` nem mensagens detalhadas do Zod (`issues`).

- **`src/context/ThemeContext.tsx` (11 sobreviventes):**
  - Valores de fallback da cor do tema quando `localStorage` retorna string inválida não mapeada no enum.

- **`src/context/AuthContext.tsx` (27 sobreviventes):**
  - Inicialização com valores padrão de estados transitórios (`carregando: false`, `erro: null`) e chaves auxiliares de serialização.

- **`src/components/PerfilModal.tsx` (33 sobreviventes):**
  - Estilização condicional de cards por função (`ADMIN`, `GERENTE`, `OPERADOR`) e micro-interações do Motion (`whileTap`).

- **`src/pages/Login.tsx` (6 sobreviventes):**
  - Valores de inicialização `useState('')` para formulários controlados, `e.preventDefault()` e fallback de mood do mascote Smash.

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
