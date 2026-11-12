# Tarefas do agente FRONT

Pendências que sobraram do endurecimento F4–F6 (PRs #72, #73 e #74, em 11/11/2026). Cada arquivo é
**uma** correção, com o problema, onde está no código, o teste que precisa falhar antes e o critério
de pronto. Pegue uma tarefa por branch e por PR.

| # | Tarefa | Tipo | Estado |
|---|---|---|---|
| 01 | [Som do leitor de QR com armazenamento bloqueado](01-som-leitor-armazenamento-bloqueado.md) | fix | FEITA (#78) |
| 02 | [Switch de som com alvo de toque de 28px](02-switch-som-alvo-de-toque.md) | fix | PENDENTE |
| 03 | [Diálogo de confirmação sobrevive ao fim da sessão](03-confirmacao-apos-fim-da-sessao.md) | fix | PENDENTE |
| 04 | [Data e saudação do Início não viram à meia-noite](04-inicio-virada-da-meia-noite.md) | fix | PENDENTE |
| 05 | [Medir e fechar a mutação de F5 e F6](05-mutacao-f5-f6.md) | test | PENDENTE |
| 06 | [Conferência visual no navegador (claro, escuro e celular)](06-conferencia-visual-f4-f5-f6.md) | test | PENDENTE |
| 07 | [Editar e excluir insumo dentro do Sheet do Estoque](07-estoque-editar-excluir-no-sheet.md) | feat | PENDENTE |
| 08 | [Remover a dependência `recharts`](08-remover-recharts.md) | chore | BLOQUEADA (aprovação do dono) |

## Como trabalhar uma tarefa
1. Leia `AGENTS.md` e a tarefa inteira. Não leia o `PLANO_FRONTEND.md` inteiro, só a fase citada.
2. `git fetch && git checkout -b fix/frontend-<slug-da-tarefa> origin/main`.
3. Antes de mudar função, hook ou componente compartilhado: `graphify affected "<nome>"`.
   Para se localizar: `graphify query "<assunto da tarefa>" --budget 1500`.
4. Escreva primeiro o teste que a tarefa descreve e mostre que ele **falha**. Depois corrija.
5. `npm --prefix frontend run lint`, `npm --prefix frontend test` e `npm --prefix frontend run build`
   verdes antes de cada commit. Zero edições em `backend/` (demanda de backend vai para
   `docs/requests.md`).
6. No mesmo PR, troque o estado da tarefa nesta tabela para **FEITA (#PR)** e marque o
   critério de pronto no arquivo da tarefa.

Tarefa nova? Crie `NN-slug.md` com as mesmas seções (Contexto, Problema, Comportamento esperado,
Teste que deve falhar antes, Critério de pronto, Fora do escopo) e acrescente uma linha na tabela.
