# Tarefas do agente BACK

Pendências do backend levantadas em 12/11/2026 a partir de `docs/requests.md`, do
`docs/PLANO_PRODUCAO.md` e da revisão de prontidão para o payload real da Anota AI. Cada arquivo é
**uma** correção, com o problema, onde está no código, o teste que precisa falhar antes e o critério
de pronto. Pegue uma tarefa por branch e por PR.

**Estados:** PENDENTE = pode começar · BLOQUEADA = depende de algo fora do agente BACK (motivo na
tabela). Não comece tarefa BLOQUEADA: quando o bloqueio cair, o humano troca o estado aqui.

| # | Tarefa | Tipo | Estado |
|---|---|---|---|
| 01 | [`fatorPerda` negativo na produção interna](01-fatorperda-negativo-producao.md) | fix | FEITA (#85) |
| 02 | [Mensagens do Zod em português](02-zod-mensagens-pt-br.md) | fix | FEITA (#86) |
| 03 | [Data de emissão da nota inventada ou aceita sem validação](03-nf-data-de-emissao.md) | fix | FEITA (#87) |
| 04 | [Documentar validade em `estoqueAlerta` do dashboard](04-dashboard-contrato-validade-estoquealerta.md) | docs | FEITA (#89) |
| 05 | [`perdasPorMotivo` sempre com os 4 motivos zerados](05-dashboard-perdas-motivos-zerados.md) | fix | FEITA (#90) |
| 06 | [Top 10 de consumo ordenado por quantidade de unidades diferentes](06-dashboard-consumo-top10-por-valor.md) | fix | PENDENTE |
| 07 | [Insumo sem estoque mínimo conta como crítico](07-dashboard-alerta-estoque-minimo-zero.md) | fix | BLOQUEADA (decisão do dono) |
| 08 | [Contrato do `DELETE` diz 500, o código responde 409](08-contrato-p2003-409.md) | docs | FEITA (#88) |
| 09 | [`bodyLimit` explícito no Fastify](09-http-bodylimit-explicito.md) | fix | FEITA (#92) |
| 10 | [Rota para listar as vendas retidas e o motivo](10-vendas-retidas-listagem.md) | feat | FEITA (#94) |
| 11 | [Alerta quando a consolidação deixa vendas retidas](11-alerta-consolidacao-com-pendencias.md) | feat | FEITA (#95) |
| 12 | [Modo sombra do webhook da Anota AI](12-webhook-modo-sombra.md) | feat | FEITA (#93) |
| 13 | [Aplicar a matriz de permissões (RBAC) nas rotas](13-rbac-matriz-de-permissoes.md) | feat | BLOQUEADA (decisão do dono) |
| 14 | [Ajuste e inventário de estoque](14-ajuste-inventario-estoque.md) | feat | BLOQUEADA (dono + schema) |
| 15 | [Validade por lote produzido (A1)](15-validade-por-lote-a1.md) | feat | BLOQUEADA (dono + schema) |
| 16 | [Índice único de `nomeNormalizado` em `Produto`](16-produto-nomenormalizado-unico.md) | fix | BLOQUEADA (schema) |
| 17 | [Vínculo de produto pelo ID da Anota AI (`codigoExterno`)](17-produto-codigo-externo-anotaai.md) | feat | BLOQUEADA (schema + payload real) |
| 18 | [Adicionais e observações (`subItems`) na consolidação](18-anotaai-subitems-adicionais.md) | feat | BLOQUEADA (payload real + dono) |
| 19 | [Cancelamento depois da consolidação](19-cancelamento-apos-consolidacao.md) | feat | BLOQUEADA (decisão do dono) |

Ordem sugerida para as PENDENTES: 01 → 02 → 03 → 08 → 04 → 05 → 06 → 09 → 12 → 10 → 11.
Antes do primeiro payload real da Anota AI, as tarefas **12, 10 e 11** são as que importam: sem elas
uma venda retida fica invisível e o estoque para de baixar sem ninguém saber.

## Como trabalhar uma tarefa
1. Leia `AGENTS.md` e a tarefa inteira. Do `docs/PLANO.md`, leia só a fase citada.
2. `git fetch && git checkout -b <tipo>/backend-<slug-da-tarefa> origin/main`.
3. Antes de mudar função, serviço ou repositório compartilhado: `graphify affected "<nome>"`.
   Para se localizar: `graphify query "<assunto da tarefa>" --budget 1500`.
4. Escreva primeiro o teste que a tarefa descreve e mostre que ele **falha**. Depois corrija.
5. Testes que tocam banco usam `DATABASE_URL_TEST` (porta 5433, `docker compose up -d`), nunca o
   banco de dev. Antes de cada commit: `npm --prefix backend run build` e `npm --prefix backend test`
   verdes. Para serviços de escrita, `npm --prefix backend run test:mutation` no arquivo tocado
   (meta ≥ 85%, `docs/PLANO_PRODUCAO.md`).
6. Mudou rota, campo de resposta ou código de erro? Atualize `docs/api.md` **no mesmo commit**.
7. Precisa de schema, migration ou seed? Pare e registre em `docs/requests.md` (dono: agente DB / humano).
8. No mesmo PR: troque o estado na tabela para **FEITA (#PR)**, marque o critério de pronto no arquivo
   da tarefa e mude a entrada correspondente de `docs/requests.md` para **RESOLVIDO** (quando houver).

Tarefa nova? Crie `NN-slug.md` com as mesmas seções (Contexto, Problema, Comportamento esperado,
Teste que deve falhar antes, Critério de pronto, Fora do escopo) e acrescente uma linha na tabela.
