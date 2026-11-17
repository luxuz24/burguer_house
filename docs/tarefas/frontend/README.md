# Tarefas do agente FRONT

Cada arquivo é **uma** mudança (fix, feat, test ou chore), com contexto, problema, comportamento
esperado, o teste que precisa falhar antes e o critério de pronto. Pegue uma tarefa por branch e por PR.

**Onde está cada coisa**
- Esta pasta: tarefas **abertas** (Fase 4) e **bloqueadas**.
- [`realizadas/`](realizadas/README.md): tarefas **concluídas** (arquivo, capturas e evidências + índice com o PR de cada uma).
- Visão geral das fases, dependências e ordem entre backend e frontend: [`../README.md`](../README.md).

## Fase 4 — Telas das funcionalidades da hamburgueria
Cada tarefa depende de uma tarefa do backend (coluna "Depende de"). **Não comece uma tela antes de a rota
existir na `main`** e confirme o formato em `docs/api.md`. Ordem sugerida:
**09 → 07 → 10 → 11 → 15 → 16 → 12 → 13 → 14 → 20 → 17 → 18 → 19** (a 09 e a 07 não dependem da Fase 3).

| # | Tarefa | Tipo | Depende de | Estado |
|---|---|---|---|---|
| 15 | [Entrada manual de estoque (nota perdida)](15-entrada-manual-estoque-tela.md) | feat | backend 23, front 10 | PENDENTE |
| 16 | [Histórico de movimentações do insumo](16-historico-movimentacoes.md) | feat | backend 23, front 07 e 15 | PENDENTE |
| 17 | [Relatórios: mostrar quantos pedidos vieram do fechamento manual](17-relatorios-vendas-manuais.md) | feat | backend 24, front 20 (feita) | PENDENTE |
| 18 | [Conferência visual e de uso real da Fase 4](18-conferencia-visual-fase4.md) | test | 09–17 e 20, backend 28 | PENDENTE (por último) |
| 19 | [Medir e fechar a mutação das telas da Fase 4](19-mutacao-fase4.md) | test | 10–17 e 20 | PENDENTE (por último) |

## Bloqueadas
| # | Tarefa | Tipo | Estado |
|---|---|---|---|
| 08 | [Remover a dependência `recharts`](08-remover-recharts.md) | chore | BLOQUEADA (aprovação do dono) |

## Padrões obrigatórios das telas novas
Valem para toda tarefa da Fase 4 (não repetidos em cada arquivo):
- **Alvos de toque** de no mínimo 44×44px (`min-h-[44px]`), nome acessível, teclado e leitor de tela.
- **Tokens de design** (sem cores literais; o teste `esperarSemCoresLiterais` cobre o arquivo), claro **e** escuro, sem rolagem horizontal em 375px.
- **Envio**: `useEnvio` para travar duplo toque; **carga**: `useCarregamento` com mensagem do backend e "Tentar novamente".
- **Feedback**: `toast`/`confirmar` do `FeedbackContext` (diálogos de confirmação são cancelados quando a sessão cai).
- **Formatos pt-BR** (`lib/formatar.ts`: `formatarMoeda`, `formatarQuantidade`, `dataHojeNaLoja`...), **fuso da loja** `America/Campo_Grande`, nunca o do aparelho.
- **Unidades**: quantidade e custo são sempre na unidade do insumo (R$ por grama, nunca R$ por kg); conversões pela lib existente (`lib/unidades.ts`, `lib/notaFiscal.ts`), sem duplicar.
- **Idempotência**: operações que alteram estoque enviam `chaveIdempotencia` gerada por `gerarChaveIdempotencia()` (com fallback para contexto não seguro), reaproveitada em reenvio e trocada quando o conteúdo muda.
- **Armazenamento**: nada essencial em `localStorage` (pode estar bloqueado); usar `lib/armazenamento.ts` quando precisar.
- **Evidência visual**: dados reais (não banco vazio), tema provado por **medição da cor de fundo** de cada PNG, tabela com ✅/❌/NÃO VERIFICADO.
- **Zero edições em `backend/`**: o que faltar no backend vai para `docs/requests.md`.

## Como trabalhar uma tarefa
1. Leia `AGENTS.md` e a tarefa inteira. Não leia o `PLANO_FRONTEND.md` inteiro, só a fase citada.
2. `git fetch && git checkout -b <tipo>/frontend-<slug-da-tarefa> origin/main`.
3. Antes de mudar função, hook ou componente compartilhado: `graphify affected "<nome>"`.
   Para se localizar: `graphify query "<assunto da tarefa>" --budget 1500`.
4. Escreva primeiro o teste que a tarefa descreve e mostre que ele **falha**. Depois corrija.
5. `npm --prefix frontend run lint`, `npm --prefix frontend test` e `npm --prefix frontend run build`
   verdes antes de cada commit.
6. **No mesmo PR, ao concluir:** troque o estado para FEITA (#PR) no arquivo, **mova o arquivo para
   `realizadas/`** (`git mv`, levando junto qualquer pasta de capturas/evidências que ele cite), tire a
   linha desta tabela e acrescente-a em [`realizadas/README.md`](realizadas/README.md). Marque o critério de pronto.

Tarefa nova? Crie `NN-slug.md` com as mesmas seções (Contexto, Problema, Comportamento esperado,
Teste que deve falhar antes, Critério de pronto, Fora do escopo) e acrescente uma linha na tabela.
