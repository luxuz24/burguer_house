# 27 — Convivência entre fechamento manual e webhook (evitar baixa em dobro)

- **Tipo:** feat · **Fase:** 3 (pós) · **Estado:** BLOQUEADA — decisão do dono + formato real do webhook
- **Origem:** Risco apontado nas revisões: quando a integração real ligar, os dias já lançados à mão não podem ser lançados de novo, e os pedidos que o webhook trouxer para esses dias não podem baixar estoque outra vez.
- **Depende de:** [22](22-fechamento-manual-dia.md), [12 (modo sombra, feita)](realizadas/12-webhook-modo-sombra.md), [20 (marcar tratadas, feita)](realizadas/20-marcar-vendas-tratadas.md)
- **Arquivos (quando liberada):** `backend/src/modules/vendas/`, `backend/src/infra/http/controllers/webhook.controller.ts`, `docs/api.md`, `docs/MODO_SOMBRA_ANOTAAI.md`
- **Branch sugerida:** `feat/backend-convivencia-manual-webhook`

## Contexto
O fechamento manual é uma ponte enquanto não há integração. Quando o webhook (ou o consultador da API de parceiros) começar a trazer pedidos reais, o mesmo dia pode ter vendas dos dois tipos. Hoje nada impede isso.

## Problema
Sem uma regra, há dois caminhos de baixa dupla: (1) o operador lança fechamento manual de um dia já coberto pelo webhook; (2) o webhook entrega pedidos de um dia que já foi fechado à mão (ex.: modo sombra desligado depois de semanas de fechamento manual).

## Decisões do dono (necessárias antes de começar)
1. **Qual fonte vale por dia?** Opções: (a) o dia é manual **ou** webhook, nunca os dois; (b) vale sempre o webhook e o fechamento manual só preenche dias sem nenhum pedido de webhook; (c) o operador escolhe.
2. **Data de corte da virada:** dia a partir do qual a integração passa a valer (alimenta o `marcar-tratadas` da tarefa 20 para as vendas acumuladas em sombra).
3. O que fazer se o operador insiste em lançar um dia já coberto: bloquear (`409`) ou só avisar?

## Comportamento esperado (recomendação, a confirmar com o dono)
- `POST /api/vendas/fechamento-manual` e a simulação respondem `409` (com a mensagem e a contagem) se já existir venda `WEBHOOK` processada no dia informado.
- Variável `INTEGRACAO_ANOTAAI_DESDE=AAAA-MM-DD` (opcional): vendas `WEBHOOK` com `ocorridoEm` anterior à data de corte entram como já tratadas (sem baixar estoque), com `_tratamento.motivo = "coberto por fechamento manual"`.
- Resposta da simulação traz `avisos` quando o dia tem vendas de webhook ainda pendentes.
- Documentar o procedimento de virada passo a passo em `docs/MODO_SOMBRA_ANOTAAI.md`.

## Teste que deve falhar antes
- Dia com venda `WEBHOOK` processada → fechamento manual recusado (`409`) conforme a decisão do dono.
- Venda `WEBHOOK` anterior à data de corte não baixa estoque e fica marcada como tratada.
- Dia sem webhook continua aceitando o fechamento manual.

## Critério de pronto
- [ ] Decisões do dono registradas em `docs/requests.md` (RESOLVIDO).
- [ ] RED/GREEN no banco `_test`; `docs/api.md` e `docs/MODO_SOMBRA_ANOTAAI.md` atualizados.
- [ ] Linha marcada `FEITA (#PR)` e arquivo movido para `realizadas/`.

## Fora do escopo
Implementar o consultador da API de parceiros (`ping/list`), RBAC, tela do frontend.
