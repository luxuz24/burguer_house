# 13 — Fechamento do dia: confirmação, idempotência e estorno

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Pedido da hamburgueria; segurança do fechamento manual (baixa duplicada e erro de digitação)
- **Depende de:** frontend [12](12-fechamento-dia-tela-e-simulacao.md); backend [22](../backend/22-fechamento-manual-dia.md) (`POST /api/vendas/fechamento-manual`) e [25](../backend/25-fechamento-manual-estorno.md) (`POST /api/vendas/:id/estornar`)
- **Arquivos:** `frontend/src/pages/FechamentoDia.tsx`, `frontend/src/lib/` (reutiliza o helper `gerarChaveIdempotencia()` da [15](15-entrada-manual-estoque-tela.md); se a 15 ainda não foi feita, criar o helper aqui conforme descrito lá), specs
- **Branch sugerida:** `feat/frontend-fechamento-dia-confirmacao`

## Contexto
Depois de ver o impacto, o operador confirma e o estoque baixa. O backend exige uma `chaveIdempotencia` (8..100 caracteres): a mesma chave com o mesmo conteúdo devolve o resultado anterior (`200`, `reaproveitado: true`), com conteúdo diferente devolve `409`. O estorno desfaz um fechamento manual devolvendo exatamente o que foi baixado.

## Problema
O risco real é a **baixa em dobro**: duplo toque no botão, ou toque de novo depois de uma falha de rede sem saber se a primeira chamada passou. E o operador precisa de uma saída quando lança o dia errado ou a quantidade errada.

## Comportamento esperado
### Confirmar
- Botão **"Confirmar baixa"** na área de impacto: só habilitado quando a simulação está **atual** (a [12](12-fechamento-dia-tela-e-simulacao.md) invalida) e `podeConfirmar: true`.
- Ao tocar: `confirmar()` do `FeedbackContext` com resumo ("Dar baixa de 8 itens do dia 13/11? O estoque será reduzido.") e, se `temNegativo`, um aviso explícito de que algum insumo ficará negativo.
- **Chave de idempotência**: gerar com `gerarChaveIdempotencia()` **uma vez por tentativa**, guardar numa `ref` e **reaproveitar** em qualquer reenvio (falha de rede, timeout, erro `5xx`); **trocar** a chave só quando o usuário muda itens, quantidades ou data.
- Trava contra duplo toque com `useEnvio` (uma chamada por vez).
- Resultados:
  - `201`: tela de sucesso "Baixa registrada" com o resumo dos itens, a lista do que foi baixado e, se houver, `insumosComEstoqueNegativo` em destaque; botão **"Desfazer"** (estorno) e botão "Concluir".
  - `200` com `reaproveitado: true`: mesmo resultado, com a nota neutra "Este fechamento já tinha sido registrado." (sem alarme, sem baixar de novo).
  - `422`: mostra `produtosSemFicha`/`produtosNaoEncontrados` e mantém a tela editável.
  - `409`: "Esta tentativa já foi usada com outro conteúdo." — gerar chave nova e orientar a conferir a lista do dia antes de tentar de novo.
  - Falha de rede/`5xx`: mantém tudo e a chave; mensagem "Não foi possível confirmar. Toque em Tentar novamente: nada será baixado em dobro."

### Estorno
- Botão **"Desfazer"** abre um Sheet com **motivo obrigatório** (1..500, contador de caracteres) e botão "Estornar fechamento".
- `confirmar()` antes de enviar; `useEnvio` contra duplo toque; `POST /api/vendas/:id/estornar` com `{ motivo }`.
- Sucesso `200`: a tela mostra "Fechamento estornado" e as `devolucoes` (insumo, quantidade devolvida, estoque atual); o botão "Desfazer" some e vira o selo "Estornado".
- `409` (já estornado): mensagem clara e atualiza o estado para "Estornado". `404`/`400`/`422`: mensagem do backend.
- O estorno também é oferecido na lista do dia ([14](14-fechamento-dia-lista-do-dia.md)) reutilizando o **mesmo** componente de Sheet.

## Teste que deve falhar antes
- Confirmar chama `POST /vendas/fechamento-manual` com `chaveIdempotencia` (8..100 caracteres), `data` e `itens` (só os `> 0`); o botão só habilita com simulação atual e `podeConfirmar`.
- **Duplo clique** em "Confirmar baixa" faz **uma** chamada.
- Falha de rede seguida de novo toque reenvia **a mesma chave**; mudar uma quantidade gera **chave nova**.
- `200` com `reaproveitado: true` mostra a mensagem neutra; `201` mostra o sucesso e os negativos; `409`/`422` mostram as mensagens e mantêm a edição.
- Estorno: motivo vazio não envia; com motivo, chama `POST /vendas/<id>/estornar`; segundo toque não envia de novo; `409` marca "Estornado".
- A chave é gerada mesmo sem `crypto.randomUUID` (stub), cobrindo `http://IP` no celular.
- Regressão: a [12](12-fechamento-dia-tela-e-simulacao.md) segue verde.

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador **e no celular por `http://IP` e `https://IP`**: fazer um fechamento real, conferir o estoque, estornar e conferir que voltou; capturas e **medição da cor de fundo** dos PNGs, com dados reais.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Lista do dia ([14](14-fechamento-dia-lista-do-dia.md)), edição de fechamento (o caminho é estornar e lançar de novo), mudanças no backend.
