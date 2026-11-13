# Tarefas do projeto (visão geral)

Índice das tarefas por fase, com as dependências entre backend e frontend. Cada tarefa é **um arquivo,
um branch e um PR**. As concluídas ficam em `realizadas/` de cada pasta.

| Pasta | Conteúdo |
|---|---|
| [`backend/`](backend/README.md) | Tarefas abertas e bloqueadas do agente BACK · [`backend/realizadas/`](backend/realizadas/README.md) |
| [`frontend/`](frontend/README.md) | Tarefas abertas e bloqueadas do agente FRONT · [`frontend/realizadas/`](frontend/realizadas/README.md) |

## Fases
| Fase | O quê | Situação |
|---|---|---|
| 1 — Endurecimento do backend | Tarefas 01–12 e 20 do backend (PRs #85–#96) | **Concluída** |
| 2 — Schema | Categoria do insumo, origem/data real da venda, movimentação de estoque (PR #97) | **Concluída** |
| 3 — Backend das funcionalidades da loja | Backend 21–26 e 28 (27 aguarda o dono) | Pendente |
| 4 — Telas das funcionalidades da loja | Frontend 10–19, mais a 07 e a 09 | Pendente (depende da Fase 3) |

As funcionalidades pedidas pela hamburgueria nas Fases 3 e 4:
1. **Estoque separado em Insumos, Embalagens e Bebidas** (abas).
2. **Fechamento manual do dia**: informar o que saiu e dar baixa no estoque (ponte enquanto a Anota AI não está integrada), com simulação, confirmação segura, estorno e lista do dia.
3. **Entrada manual de estoque** para quando a nota fiscal é perdida, em lote e com histórico.

## Quem depende de quem
```
Backend 21 (categoria) ──────► Front 10 (abas) ──► Front 11 (categoria no cadastro)
Backend 23 (entrada manual) ─► Front 15 (tela) ───► Front 16 (histórico)
Backend 22 (fechamento) ─────► Front 12 (simulação) ─► Front 13 (confirmar/estornar) ─► Front 14 (lista do dia)
   └─► Backend 25 (estorno) ──────────────────────────────┘ (13)
   └─► Backend 26 (listagem) ─────────────────────────────────────────────────────────┘ (14)
Backend 22 + 25 ─► Backend 24 (relatórios por ocorridoEm) ─► Front 17 (vendas manuais nos relatórios)
Backend 21–26 ─► Backend 28 (teste de ponta a ponta) ─┐
Front 09–17 ──────────────────────────────────────────┴─► Front 18 (conferência) e Front 19 (mutação)
Backend 27 (convivência manual × webhook): BLOQUEADA, decisão do dono (antes de ligar a integração real)
```
Ordem prática: **backend 21 → 23 → 22 → 25 → 26 → 24 → 28**, e o frontend acompanha cada rota assim que ela
entra na `main` (09 e 07 podem começar já).

## Contratos que o frontend consome (fonte: `docs/api.md`, atualizado no PR de cada tarefa de backend)
| Rota | Tarefa | Usada em |
|---|---|---|
| `GET /api/insumos?categoria=` (campo `categoria`) | backend 21 | front 10, 11 |
| `POST /api/estoque/entradas-manuais`, `GET /api/estoque/movimentacoes` | backend 23 | front 15, 16 |
| `POST /api/vendas/fechamento-manual/simulacao`, `POST /api/vendas/fechamento-manual` | backend 22 | front 12, 13 |
| `POST /api/vendas/:id/estornar` | backend 25 | front 13, 14 |
| `GET /api/vendas/fechamentos-manuais` | backend 26 | front 14 |
| `GET /api/dashboard/resumo` (`kpis.vendasManuaisQtd/Valor`) | backend 24 | front 17 |
| `GET /api/vendas/retidas` | backend 10 (feita) | front 09 |

## Regras que valem para todas as tarefas (aprendidas nas revisões das fases 1 e 2)
- **Teste que falha antes**, com a saída vermelha no PR; só depois a correção.
- **Mutação**: serviços de escrita do backend ≥ 85%; telas do frontend ≥ 80%; sobrevivente justificado **um a um**.
- **Banco**: testes só no `DATABASE_URL_TEST` (porta 5433). Nunca rodar seed, `migrate reset` ou `db push --force-reset` no banco de dev sem confirmação do humano. Migrations em dev só com `migrate deploy` depois de um dump.
- **Custos sempre por unidade de medida do insumo** (R$/g, R$/ml, R$/un). Dado de teste com R$/kg já inflou valores 1000× numa conferência.
- **Operações que mexem em estoque** são atômicas, idempotentes (chave obrigatória) e têm teste de concorrência.
- **Privacidade**: fixtures e logs sem dados pessoais (lista de campos **permitidos**, nunca de campos proibidos); texto livre do cliente é removido.
- **Evidência visual** honesta: dados reais, tema provado por medição da cor de fundo de cada PNG, tabela com ✅/❌/NÃO VERIFICADO, console registrado; erro inesperado é investigado, não rotulado de "esperado".
- **Git**: nunca na `main`; um commit por mudança lógica; `git add` por caminho; em PR aberto atualizar com `git merge origin/main` (nunca `rebase` nem `push --force`); nada de `.env`; sem dependências novas sem pedir.
- **Ao concluir uma tarefa**: marcar FEITA (#PR), **mover o arquivo para `realizadas/`** e atualizar os índices no mesmo PR.
