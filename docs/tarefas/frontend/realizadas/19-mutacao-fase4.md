# 19 — Medir e fechar a mutação das telas da Fase 4

- **Tipo:** test · **Fase:** 4 · **Estado:** FEITA (#126)
- **Origem:** Testes que passam não provam que protegem. A [tarefa 05](05-mutacao-f5-f6.md) mediu F5/F6 e mostrou lacunas reais (ex.: fechar o Perfil sem teste). As telas da Fase 4 mexem em estoque e dinheiro.
- **Depende de:** frontend [10](10-estoque-abas-por-categoria.md) a [17](17-relatorios-vendas-manuais.md)
- **Branch sugerida:** `test/frontend-mutacao-fase4`

## Contexto
O frontend não tem Stryker como dependência e **não é permitido adicionar** sem aprovação. Rode de **fora** do repositório (no scratchpad/`/tmp`), uma cópia de configuração por arquivo, como descrito em [05-mutacao-f5-f6.md](05-mutacao-f5-f6.md) ("Como rodar"). Não commitar nada do Stryker (`.stryker-tmp`, relatórios).

## Problema
Sem medir, não sabemos se os testes das telas novas pegam as regressões que mais custam: chave de idempotência trocada ou não, botão habilitado com simulação obsoleta, quantidade fora do limite, unidade kg/g convertida errada, estorno que some depois de feito.

## Escopo (um arquivo por vez; a rodada com tudo junto é lenta)
- Telas/componentes Fase 4: `pages/FechamentoDia.tsx`, `pages/EntradaManual.tsx`, `pages/ContagemEstoque.tsx`, `components/HistoricoMovimentacoes.tsx`, `pages/Usuarios.tsx`, `components/ConfiguracoesModal.tsx`.
- Libs Fase 4: `lib/fechamentoDia.ts`, `lib/saidaEstoque.ts`, `lib/entradaManual.ts`, `lib/contagemEstoque.ts`, `lib/chaveIdempotencia.ts` ([15](15-entrada-manual-estoque-tela.md)), `lib/categoriaInsumo.ts`.
- Trechos Fase 4 em telas existentes: `pages/Estoque.tsx` (L194–196, L332–354, L393–398, L417–425, L493–529, L560–677, L741–745: abas, categoria, botão "Contagem", Entrada Manual e Histórico), `pages/Dashboard.tsx` (L180–193, L336–365: saídas/vendas manuais e entrada manual) e `pages/Inicio.tsx` (L142–150, L224–244: resumo de vendas manuais).

## Resultado da Mutação (Antes → Depois)

| Arquivo / Trecho | Score Inicial | Score Final | Mortos / Total | Situação |
|---|---|---|---|---|
| `src/pages/FechamentoDia.tsx` | 75,42% (267/354) | **88,14%** | 312 / 354 | ≥ 80% ✅ |
| `src/lib/fechamentoDia.ts` | 84,01% (226/269) | **84,01%** | 226 / 269 | ≥ 80% ✅ |
| `src/lib/saidaEstoque.ts` | 92,11% (35/38) | **92,11%** | 35 / 38 | ≥ 80% ✅ |
| `src/pages/EntradaManual.tsx` | 63,74% (225/353) | **85,27%** | 301 / 353 | ≥ 80% ✅ |
| `src/lib/entradaManual.ts` | 78,57% (242/308) | **95,78%** | 295 / 308 | ≥ 80% ✅ |
| `src/lib/chaveIdempotencia.ts` | 93,55% (29/31) | **96,77%** | 30 / 31 | ≥ 80% ✅ |
| `src/pages/ContagemEstoque.tsx` | 48,61% (157/323) | **85,45%** | 276 / 323 | ≥ 80% ✅ |
| `src/lib/contagemEstoque.ts` | 57,77% (145/251) | **92,83%** | 233 / 251 | ≥ 80% ✅ |
| `src/components/HistoricoMovimentacoes.tsx` | 51,53% (118/229) | **82,10%** | 188 / 229 | ≥ 80% ✅ |
| `src/pages/Usuarios.tsx` | 57,37% (257/448) | **83,71%** | 375 / 448 | ≥ 80% ✅ |
| `src/components/ConfiguracoesModal.tsx` | 77,78% (35/45) | **97,78%** | 44 / 45 | ≥ 80% ✅ |
| `src/lib/categoriaInsumo.ts` | 100,00% (12/12) | **100,00%** | 12 / 12 | ≥ 80% ✅ |
| `src/pages/Estoque.tsx` (trechos F4) | 65,10% (125/192) | **82,72%** | 158 / 191* | ≥ 80% ✅ |
| `src/pages/Dashboard.tsx` (trechos F4) | 97,26% (71/73) | **97,26%** | 71 / 73 | ≥ 80% ✅ |
| `src/pages/Inicio.tsx` (trechos F4) | 96,88% (31/32) | **96,88%** | 31 / 32 | ≥ 80% ✅ |

*\* Em `Estoque.tsx` (trechos F4), 1 mutante (`L499: if (proximoIndice === null) return;` → `false`) resultou em `RuntimeError` esperado em tecla não mapeada (`Enter`), fora dos 191 válidos considerados no percentual do Stryker (`82,29%` se contado no denominador).*

Todos os arquivos e trechos ficaram acima de **80%** e os mutantes prioritários foram eliminados (chave de idempotência reaproveitada em rede e trocada após 409/edição; limites `0..500` e sem data futura em `FechamentoDia`; botão de confirmar desabilitado com simulação desatualizada ou `podeConfirmar: false`; recusa de `"5.000"`, `0` aceito na contagem e recusado na entrada manual; diferença com sinal na contagem; conversões `kg↔g` e custo `R$/unidade`; bloqueio de insumo duplicado; aviso `"já existe fechamento no dia"`; estorno oculto após concluir; botão `"Contagem"` restrito a `ADMIN`/`GERENTE`; `"Usuários"` restrito a `ADMIN`; proteção da própria conta e `PATCH` só com campos alterados).

## Comportamento esperado
1. Medir cada arquivo e registrar a nota inicial.
2. Para cada sobrevivente que **muda comportamento** (não estilo ou animação), escrever um teste de **comportamento** (nunca testar o código da mutação).
3. Meta **≥ 80%** por arquivo. Abaixo disso, justificar **cada sobrevivente individualmente** (linha, mutação, por que é equivalente ou visual), não por grupo.
4. Priorizar estes pontos (têm que estar mortos): troca/reaproveitamento da chave de idempotência; limites 0..500 e data sem futuro; botão de confirmar desabilitado com impacto obsoleto ou `podeConfirmar: false`; conversão kg↔g e custo R$/unidade; estorno oculto depois de feito; aviso de "já existe fechamento no dia"; insumo repetido bloqueado na entrada manual.
5. Tabela antes → depois no PR.

## Teste que deve falhar antes
Cada teste novo é validado revertendo manualmente a mutação correspondente e vendo-o falhar.

## Critério de pronto
- [x] Nota de **cada** arquivo medida e ≥ 80%, ou sobreviventes justificados um a um (linha por linha).
- [x] Só arquivos `*.spec.ts(x)` alterados; se um teste revelar bug, **pare**, registre como tarefa nova e corrija em outro PR.
- [x] `lint`, `test` e `build` verdes; nenhum artefato do Stryker commitado; nenhum `package.json`/`package-lock.json` alterado.
- [x] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Mutação do backend (tarefas de cada rota), adicionar Stryker ao projeto.
