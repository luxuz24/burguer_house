# Tarefas do agente BACK

Cada arquivo é **uma** mudança (fix, feat, docs ou test), com contexto, problema, comportamento
esperado, o teste que precisa falhar antes e o critério de pronto. Pegue uma tarefa por branch e por PR.

**Onde está cada coisa**
- Esta pasta: tarefas **abertas** (Fase 3) e **bloqueadas**.
- [`realizadas/`](realizadas/README.md): tarefas **concluídas** (arquivo + índice com o PR de cada uma).
- Visão geral das fases, dependências e ordem entre backend e frontend: [`../README.md`](../README.md).

**Estados:** PENDENTE = pode começar · BLOQUEADA = depende de algo fora do agente BACK (motivo na
tabela). Não comece tarefa BLOQUEADA: quando o bloqueio cair, o humano troca o estado aqui.

## Fase 3 — Funcionalidades da hamburgueria (schema pronto na Fase 2, PR #97)
Ordem: **21 → 23 → 22 → 25 → 26 → 24 → 28 → 29**. A 27 espera o dono.

| # | Tarefa | Tipo | Depende de | Estado |
|---|---|---|---|---|
| 29 | [Saída do dia em quantidade, sem valores em R$](29-saida-do-dia-em-quantidade.md) | feat | 24, 25 (feitas) | PENDENTE |
| 27 | [Convivência entre fechamento manual e webhook](27-convivencia-manual-webhook.md) | feat | 22, decisão do dono | BLOQUEADA (decisão do dono + formato real do webhook) |

## Bloqueadas (fora das fases em andamento)
| # | Tarefa | Tipo | Estado |
|---|---|---|---|
| 07 | [Insumo sem estoque mínimo conta como crítico](07-dashboard-alerta-estoque-minimo-zero.md) | fix | BLOQUEADA (decisão do dono) |
| 13 | [Aplicar a matriz de permissões (RBAC) nas rotas](13-rbac-matriz-de-permissoes.md) | feat | BLOQUEADA (decisão do dono) |
| 14 | [Ajuste e inventário de estoque](14-ajuste-inventario-estoque.md) | feat | BLOQUEADA (dono; a base `MovimentacaoEstoque` já existe) |
| 15 | [Validade por lote produzido (A1)](15-validade-por-lote-a1.md) | feat | BLOQUEADA (dono + schema) |
| 16 | [Índice único de `nomeNormalizado` em `Produto`](16-produto-nomenormalizado-unico.md) | fix | BLOQUEADA (schema) |
| 17 | [Vínculo de produto pelo ID da Anota AI (`codigoExterno`)](17-produto-codigo-externo-anotaai.md) | feat | BLOQUEADA (schema + payload real) |
| 18 | [Adicionais e observações (`subItems`) na consolidação](18-anotaai-subitems-adicionais.md) | feat | BLOQUEADA (payload real + dono) |
| 19 | [Cancelamento depois da consolidação](19-cancelamento-apos-consolidacao.md) | feat | BLOQUEADA (decisão do dono) |

## Como trabalhar uma tarefa
1. Leia `AGENTS.md` e a tarefa inteira. Do `docs/PLANO.md`, leia só a fase citada.
2. `git fetch && git checkout -b <tipo>/backend-<slug-da-tarefa> origin/main`.
3. Antes de mudar função, serviço ou repositório compartilhado: `graphify affected "<nome>"`.
   Para se localizar: `graphify query "<assunto da tarefa>" --budget 1500`.
4. Escreva primeiro o teste que a tarefa descreve e mostre que ele **falha**. Depois corrija.
5. Testes que tocam banco usam `DATABASE_URL_TEST` (porta 5433, `docker compose up -d`), nunca o
   banco de dev. Antes de cada commit: `npm --prefix backend run build` e `npm --prefix backend test`
   verdes. Para serviços de escrita, `npm --prefix backend run test:mutation` no arquivo tocado
   (meta ≥ 85%, `docs/PLANO_PRODUCAO.md`; sobrevivente justificado **um a um**).
6. Mudou rota, campo de resposta ou código de erro? Atualize `docs/api.md` **no mesmo commit**.
7. Precisa de schema, migration ou seed? Pare e registre em `docs/requests.md` (dono: agente DB / humano).
8. **No mesmo PR, ao concluir:** troque o estado para FEITA (#PR) no arquivo, **mova o arquivo para
   `realizadas/`** (`git mv`), tire a linha desta tabela e acrescente-a em
   [`realizadas/README.md`](realizadas/README.md). Marque o critério de pronto e, quando houver, a
   entrada de `docs/requests.md` como **RESOLVIDO**.

Tarefa nova? Crie `NN-slug.md` com as mesmas seções (Contexto, Problema, Comportamento esperado,
Teste que deve falhar antes, Critério de pronto, Fora do escopo) e acrescente uma linha na tabela da fase.
