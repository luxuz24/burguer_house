# Tarefas do agente FRONT — realizadas

Tarefas concluídas, com o PR que as entregou. Os arquivos ficam aqui como histórico, junto com as
capturas e evidências que citam. Tarefas abertas: [`../README.md`](../README.md).

## Endurecimento de F4–F6 (PRs #78 a #84, 12–13/11/2026)
| # | Tarefa | Tipo | PR |
|---|---|---|---|
| 01 | [Som do leitor de QR com armazenamento bloqueado](01-som-leitor-armazenamento-bloqueado.md) | fix | #78 |
| 02 | [Switch de som com alvo de toque de 28px](02-switch-som-alvo-de-toque.md) (capturas em [`capturas/`](capturas/)) | fix | #79 |
| 03 | [Diálogo de confirmação sobrevive ao fim da sessão](03-confirmacao-apos-fim-da-sessao.md) | fix | #80 |
| 04 | [Data e saudação do Início não viram à meia-noite](04-inicio-virada-da-meia-noite.md) | fix | #81 |
| 05 | [Medir e fechar a mutação de F5 e F6](05-mutacao-f5-f6.md) | test | #82 |
| 06 | [Conferência visual no navegador (claro, escuro e celular)](06-conferencia-visual-f4-f5-f6.md) (evidências em [`evidencias-06/`](evidencias-06/)) | test | #83 |
| — | Logout enviava corpo vazio (`415`) e não revogava o token: achado da conferência da 06 | fix | #84 |

> A conferência da tarefa 06 foi devolvida em revisão por evidência incorreta (capturas "claro" em tema escuro,
> tela errada, banco vazio). As regras para não repetir estão em [18](../18-conferencia-visual-fase4.md).

## Fase 4 — Telas das funcionalidades da hamburgueria
| # | Tarefa | Tipo | PR |
|---|---|---|---|
| 07 | [Editar e excluir insumo dentro do Sheet do Estoque](07-estoque-editar-excluir-no-sheet.md) | feat | #111 |
| 09 | [Tela / alerta para visualizar vendas retidas e corrigir cardápio](09-vendas-retidas-tela.md) | feat | #108 |
| 10 | [Estoque com abas por categoria](10-estoque-abas-por-categoria.md) | feat | #113 |
| 11 | [Categoria do insumo no cadastro e na edição](11-insumo-categoria-no-cadastro.md) | feat | #114 |
| 12 | [Fechamento do dia: tela e simulação do impacto](12-fechamento-dia-tela-e-simulacao.md) | feat | #109 |
| 13 | [Fechamento do dia: confirmação, idempotência e estorno](13-fechamento-dia-confirmacao-e-estorno.md) | feat | #110 |
| 14 | [Fechamento do dia: lançamentos do dia](14-fechamento-dia-lista-do-dia.md) | feat | #112 |
| 15 | [Entrada manual de estoque (nota perdida)](15-entrada-manual-estoque-tela.md) (evidências em [`evidencias-15/`](evidencias-15/)) | feat | #119 |
| 16 | [Histórico de movimentações do insumo](16-historico-movimentacoes.md) (evidências em [`evidencias-16/`](evidencias-16/)) | feat | #122 |
| 17 | [Relatórios: mostrar quantos pedidos vieram do fechamento manual](17-relatorios-vendas-manuais.md) | feat | #118 |
| 19 | [Medir e fechar a mutação das telas da Fase 4](19-mutacao-fase4.md) | test | #126 |
| 20 | [Mostrar a saída em quantidade e esconder o faturamento](20-saida-em-quantidade-sem-faturamento.md) | feat | #115 |
| 21 | [Contagem de estoque (ajuste por contagem física)](21-contagem-estoque-tela.md) (evidências em [`evidencias-21/`](evidencias-21/)) | feat | #123 |
| 22 | [Tela de usuários (só para o admin)](22-usuarios-tela.md) (evidências em [`evidencias-22/`](evidencias-22/)) | feat | #124 |
