# 05 — Medir e fechar o teste de mutação de F5 e F6

- **Tipo:** test · **Origem:** rodadas de mutação interrompidas no fim do F5/F6 (PRs #72 e #74)
- **Branch sugerida:** `test/frontend-mutacao-f5-f6`

## Situação medida (11/11/2026)
| Escopo | Nota | Meta |
|---|---|---|
| F4: `Inicio.tsx`, `Dashboard.tsx`, `alertasEstoque.ts`, `periodoPersonalizado.ts` | 93,12% (antes do último commit de testes) | ≥ 80% ✅ |
| F6: `lib/notaFiscal.ts` + `lib/qrImagem.ts` | 84,72% | ≥ 80% ✅ |
| F6: `pages/ImportarNotaFiscal.tsx` | **77,50%** | ≥ 80% ❌ |
| F5: `lib/api.ts`, `lib/armazenamento.ts`, `context/*`, `PerfilModal`, `ConfiguracoesModal`, `App`, `Login` | **não medida** (rodada de ~630 mutantes cortada em 18%) | ≥ 80% |

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
- [ ] Nota de **cada** arquivo do F5 medida e ≥ 80%, ou sobreviventes restantes justificados um a um.
- [ ] `ImportarNotaFiscal.tsx` ≥ 80%.
- [ ] Só arquivos `*.spec.ts(x)` alterados — se um teste revelar bug, pare, registre como tarefa nova
      neste diretório e corrija em outro PR.
- [ ] Lint, testes e build verdes; nenhum artefato do Stryker commitado.
