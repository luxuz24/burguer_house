# Tarefas do agente BACK — realizadas

Tarefas concluídas, com o PR que as entregou. Os arquivos ficam aqui como histórico (problema, decisões
e critérios de pronto marcados). Tarefas abertas: [`../README.md`](../README.md).

## Fase 1 — Endurecimento do backend (PRs #85 a #96, 12–13/11/2026)
| # | Tarefa | Tipo | PR |
|---|---|---|---|
| 01 | [`fatorPerda` negativo na produção interna](01-fatorperda-negativo-producao.md) | fix | #85 |
| 02 | [Mensagens do Zod em português](02-zod-mensagens-pt-br.md) | fix | #86 |
| 03 | [Data de emissão da nota inventada ou aceita sem validação](03-nf-data-de-emissao.md) | fix | #87 |
| 08 | [Contrato do `DELETE`: 409/404 reais](08-contrato-p2003-409.md) | docs | #88 |
| 04 | [Documentar validade em `estoqueAlerta` do dashboard](04-dashboard-contrato-validade-estoquealerta.md) | docs | #89 |
| 05 | [`perdasPorMotivo` sem motivos zerados](05-dashboard-perdas-motivos-zerados.md) | fix | #90 |
| 06 | [Top 10 de consumo ordenado por valor](06-dashboard-consumo-top10-por-valor.md) | fix | #91 |
| 09 | [`bodyLimit` explícito no Fastify](09-http-bodylimit-explicito.md) | fix | #92 |
| 12 | [Modo sombra do webhook da Anota AI](12-webhook-modo-sombra.md) | feat | #93 |
| 10 | [Rota para listar as vendas retidas e o motivo](10-vendas-retidas-listagem.md) | feat | #94 |
| 11 | [Alerta quando a consolidação deixa vendas retidas](11-alerta-consolidacao-com-pendencias.md) | feat | #95 |
| 20 | [Marcar vendas acumuladas em modo sombra como tratadas](20-marcar-vendas-tratadas.md) | feat | #96 |

## Fase 2 — Schema (sem arquivo de tarefa próprio)
Categoria do insumo, origem/data real da venda e movimentação de estoque: PR #97 (`docs/arquitetura.md`
§3 e §8 com o SQL de reversão; premissas em `docs/requests.md`).

## Fase 3 — Funcionalidades da hamburgueria
| # | Tarefa | Tipo | PR |
|---|---|---|---|
| 21 | [Categoria em Insumos: filtro, cadastro e alertas](21-insumos-categoria.md) | feat | #99 |
| 23 | [Entrada manual de estoque em lote e histórico](23-entrada-manual-estoque.md) | feat | #100 |
| 22 | [Fechamento manual do dia: simulação e confirmação (núcleo)](22-fechamento-manual-dia.md) | feat | #101 |
| 25 | [Fechamento manual: estorno](25-fechamento-manual-estorno.md) | feat | #102 |
