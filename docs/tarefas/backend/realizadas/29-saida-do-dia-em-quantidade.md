# 29 — Saída do dia em quantidade (por insumo e por produto), sem valores em R$

- **Tipo:** feat · **Fase:** 3 (complemento) · **Estado:** FEITA (#107)
- **Origem:** Decisão do dono: o app é de **estoque**, não de finanças. Quem abre o app quer ver **o que saiu no último dia**, em quantidade
- **Depende de:** [24](24-relatorios-ocorrido-em-origem.md) (dia pelo `ocorridoEm`, origem e exclusão de estornos), [25](25-fechamento-manual-estorno.md) (snapshot e `_estorno`)
- **Consumida por (frontend):** tela futura "Saída do dia" (não bloqueia a [20](../../frontend/20-saida-em-quantidade-sem-faturamento.md), que usa só o dashboard atual)
- **Arquivos:** `backend/src/modules/dashboard/` (serviço e repositório, reaproveitando a leitura de vendas por `ocorridoEm`), `backend/src/infra/http/controllers/`, `backend/src/infra/http/routes/dashboard.routes.ts`, `docs/api.md`
- **Branch sugerida:** `feat/backend-saida-do-dia`

## Contexto
Hoje o dashboard (`GET /api/dashboard/resumo`) só aceita `hoje`, `semana`, `mes` ou um intervalo `dataInicio`/`dataFim`, e mistura quantidade com valores em R$. Não existe uma visão simples de **um dia**, só com o que saiu do estoque. Os fechamentos manuais já gravam o que foi abatido em `payloadOriginal._fechamento.consumos` (snapshot), e as vendas do webhook trazem os itens pedidos.

## Problema
Para saber "o que saiu ontem" é preciso montar o intervalo à mão e ignorar os campos de valor. Além disso, o consumo de uma venda manual no dashboard é estimado pela ficha técnica **atual**, que pode diferir do que foi realmente abatido se a ficha mudou depois.

## Comportamento esperado
`GET /api/estoque/saida-dia?data=AAAA-MM-DD` (JWT; `401` sem token).
- `data` opcional (padrão: **ontem**, no fuso `America/Campo_Grande`, para responder "o último dia"; use `data` de hoje para o dia corrente). Formato inválido → `400`. Data futura é permitida e devolve listas vazias.
- Considera vendas `processado = true` com `ocorridoEm` dentro do dia da loja, de **ambas as origens** (`WEBHOOK` e `MANUAL`). **Exclui estornadas** (`_estorno`) e, no webhook, pedidos que não abatem estoque (cancelados, agendados, sem estado).
- Resposta `200`, **sem nenhum valor em R$**:
```json
{
  "data": "2026-11-15",
  "pedidos": 42,
  "itens": [{ "nome": "BACON HOUSE", "quantidade": 31 }],
  "insumos": [
    {
      "insumoId": "uuid", "nome": "Carne de Hambúrguer", "unidade": "Gramas",
      "categoria": "INGREDIENTE", "quantidadeSaiu": 9920,
      "estoqueAtual": 2080, "estoqueMinimo": 5000, "emAlerta": true
    }
  ]
}
```
  - `pedidos`: número de vendas contadas (webhook + fechamentos manuais não estornados).
  - `itens`: produtos vendidos, somando adicionais expandidos como o dashboard já faz; ordenados por `quantidade` desc.
  - `insumos`: o que saiu de cada insumo, **ordenados por categoria e por nome**; `emAlerta` reaproveita a regra de alerta existente (não duplicar).
- **Origem do consumo:** vendas `MANUAL` usam o **snapshot** `_fechamento.consumos` (o que realmente foi abatido); vendas `WEBHOOK` usam a ficha técnica com o mesmo cálculo (fator de perda) da consolidação, para paridade com o estoque.
- Sem N+1: uma consulta para as vendas do dia e uma para os insumos envolvidos.
- Não expõe `_fechamento` cru nem campos de preço.

## Teste que deve falhar antes
- Dia com um webhook aceito e um fechamento manual: `pedidos` conta os dois, `itens` e `insumos` somam as quantidades corretas.
- Fechamento manual **estornado** não entra em `pedidos`, `itens` nem `insumos`.
- Alterar a ficha técnica depois do fechamento manual **não** muda `quantidadeSaiu` desse fechamento (usa o snapshot).
- Pedido de webhook cancelado ou agendado não entra.
- Venda lançada hoje com `ocorridoEm` de 3 dias atrás aparece no dia dela, não em hoje.
- Sem `data`: usa ontem no fuso de `America/Campo_Grande` (relógio fixo perto de meia-noite, UTC virando o dia).
- `data` inválida → `400`; sem token → `401`; data futura → listas vazias; a resposta **não contém** nenhuma chave de valor em R$.
- Conservação: a soma de `quantidadeSaiu` por insumo bate com o abatimento real de estoque do dia.

## Critério de pronto
- [x] Teste novo falhou antes e passa depois; `npm --prefix backend run build` e `NODE_ENV=test npm --prefix backend test` verdes.
- [x] `npm --prefix backend run test:mutation` nos arquivos novos, meta ≥ 85% (sobrevivente justificado um a um).
- [x] `docs/api.md` com o novo endpoint no mesmo commit.
- [x] Linha marcada `FEITA (#107)` e arquivo movido para `realizadas/`.

## Fora do escopo
Mudar ou remover campos de valor do dashboard atual, preço no cadastro de produto, valor do caixa no fechamento manual, intervalo de vários dias, a tela do frontend.
