# 21 — Contagem de estoque (ajuste por contagem física)

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Decisão do dono (17/11/2026): o saldo real entra por **contagem**. Sem isso o app não pode ir para produção (os saldos do seed são de exemplo e o saldo não é editável)
- **Depende de:** backend [14](../backend/realizadas/14-ajuste-inventario-estoque.md) (`POST /api/estoque/ajustes`); frontend [15](realizadas/15-entrada-manual-estoque-tela.md) (reaproveitar parse, milhar e g/kg) e [16](16-historico-movimentacoes.md) (o histórico mostra o `AJUSTE`)
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (botão no cabeçalho), novo `frontend/src/pages/ContagemEstoque.tsx`, `frontend/src/lib/` (regras puras da contagem), specs
- **Branch sugerida:** `feat/frontend-contagem-estoque`

## Contexto
O backend recebe uma contagem em lote: para cada insumo, o **saldo encontrado na prateleira**. O saldo passa a ser o contado e a diferença vira movimentação `AJUSTE` (não é perda nem compra). Idempotência obrigatória por chave, como na entrada manual. Só `ADMIN` e `GERENTE` podem (`OPERADOR` recebe `403`).

## Problema
No primeiro dia de uso, todos os saldos estão errados (vieram do seed). Depois, a contagem semanal ou mensal precisa corrigir as diferenças sem forjar nota nem registrar perda falsa.

## Comportamento esperado
- No Estoque, botão **"Contagem"** (44px) no cabeçalho, **só para ADMIN e GERENTE** (papel do `AuthContext`; para OPERADOR o botão não aparece). Abre a tela cheia **"Contagem de estoque"**.
- Lista dos insumos agrupada pelas abas de categoria (Ingrediente, Embalagem, Bebida), com busca por nome. Cada linha: nome, **saldo no sistema** (com unidade) e um campo **"Contado"**.
- Campo vazio = **não contado** (não vai no envio). Só os preenchidos entram no lote (1 a 200).
- Quantidade: mesmas regras da [15](realizadas/15-entrada-manual-estoque-tela.md) — vírgula decimal, **recusa milhar com ponto** (`PADRAO_MILHAR` / "Para 5 mil, digite 5000"), alternar g↔kg e ml↔L com "equivale a …". **Zero é válido** (acabou o insumo); negativo não.
- Ao lado de cada contado, a **diferença** prevista com sinal e cor (`+15 un`, `−800 g`, `sem diferença`).
- **Motivo** obrigatório (3 a 500), com sugestões de um toque: "Contagem inicial", "Contagem semanal", "Contagem mensal".
- Resumo fixo no rodapé: "N itens contados · M com diferença".
- **Confirmar** com `confirmar()` listando **cada item com diferença** ("Carne de Hambúrguer: 4.000 g → 3.200 g (−800 g)") e quantos sem diferença. Botão travado com `useEnvio`.
- **Chave de idempotência** com `gerarChaveIdempotencia()`: a mesma no reenvio depois de falha de rede/5xx, nova quando qualquer contado ou o motivo muda, nova depois de `409`.
- Sucesso `201`/`200` (`reaproveitado`): tela de resultado com cada item "saldo 10 → 25 (+15)" e "Voltar ao estoque"; `reaproveitado: true` mostra "Esta contagem já tinha sido registrada." Recarrega os insumos do Estoque.
- Erros: `403` ("Só gerente ou administrador pode registrar contagem."), `404` (aponta o insumo, mantém o formulário), `409`, `400` (mensagem do backend), rede (mantém tudo e a chave).
- "Voltar" com algo preenchido pede confirmação para descartar.
- Aviso no rodapé: "O saldo de cada item passa a ser o valor contado. Lance as vendas do dia antes de contar."

## Teste que deve falhar antes
- OPERADOR não vê o botão "Contagem"; GERENTE vê e abre a tela.
- Preencher 2 de 3 insumos e confirmar envia `POST /estoque/ajustes` só com os 2, `saldoContado` na unidade do insumo (kg → g), `motivo` e `chaveIdempotencia` (8..100).
- "0" é aceito; "5.000" é recusado com a mensagem de milhar; vazio não entra no lote; motivo vazio não envia.
- A diferença prevista aparece com sinal (`+15`, `−800`, `sem diferença`).
- Confirmação lista os itens com diferença; duplo clique faz uma chamada; falha de rede reenvia a mesma chave; editar um contado gera chave nova.
- `403`, `404` e `reaproveitado: true` renderizam como descrito; sucesso recarrega o Estoque.

## Critério de pronto
- [ ] Testes novos verdes; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) com uma contagem real no banco de dev, logado como ADMIN; captura e medição da cor de fundo. A contagem de teste é desfeita **por outra contagem** pela própria tela (não por SQL).
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Tela de usuários (tarefa separada), contagem parcial salva como rascunho, exportação, mudanças no backend.
