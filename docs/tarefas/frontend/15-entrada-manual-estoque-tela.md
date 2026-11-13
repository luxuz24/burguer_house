# 15 — Entrada manual de estoque (nota fiscal perdida)

- **Tipo:** feat · **Fase:** 4 · **Estado:** PENDENTE
- **Origem:** Pedido da hamburgueria: poder dar entrada no estoque quando perdem a nota fiscal
- **Depende de:** backend [23](../backend/23-entrada-manual-estoque.md) (`POST /api/estoque/entradas-manuais`); frontend [10](10-estoque-abas-por-categoria.md)
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (botão no cabeçalho, ao lado de "Importar nota"), novo `frontend/src/pages/EntradaManual.tsx` (ou componente em `components/`), `frontend/src/lib/` (helper da chave de idempotência), `Estoque.spec.tsx` e `EntradaManual.spec.tsx`
- **Branch sugerida:** `feat/frontend-entrada-manual-estoque`

## Contexto
Hoje o saldo só sobe por importação de nota (XML ou QR code) ou produção interna. Perdeu a nota? Não há como dar entrada. O backend (tarefa 23) aceita uma entrada **em lote e atômica**, com chave de idempotência obrigatória, e devolve `saldoAnterior`/`saldoPosterior` por item e `avisos` de custo suspeito.

## Problema
Sem tela, a compra perdida simplesmente não entra no estoque, e o saldo fica abaixo do real. Uma tela ingênua teria dois riscos: **entrada duplicada** (duplo toque, reenvio depois de falha de rede) e **unidade errada** (digitar R$/kg onde o sistema espera R$/g, o que já aconteceu em dado de teste e inflou valores 1000×).

## Comportamento esperado
- No Estoque, botão **"Entrada sem nota"** (44px) no cabeçalho. Abre uma tela cheia/Sheet grande **"Entrada manual"**.
- **Observação** no topo (opcional, até 500), ex.: "Nota perdida - Atacadão".
- **Linhas** de itens (1 a 100): escolher insumo (busca por nome, com atalho por categoria — Ingrediente/Embalagem/Bebida), **quantidade** (aceita vírgula decimal pt-BR; reaproveitar o parse de `lib/notaFiscal.ts`/`lib/unidades.ts`, sem duplicar) e **custo unitário** opcional. Botão "Adicionar item" e remover linha.
- **Unidade sempre visível** ao lado do campo ("Gramas", "Unidade"). Se o insumo for em gramas ou mililitros, oferecer alternar a digitação para **kg / L**, convertendo com a lib existente antes de enviar; mostrar o texto "equivale a 5000 g". O custo é sempre **R$ por unidade de medida do insumo** (R$/g), com a conversão mostrada ("R$ 34,90/kg = R$ 0,0349/g").
- **Insumo repetido**: o seletor desabilita insumos já usados na entrada (o backend recusa repetido com `400`).
- Validação antes de enviar: pelo menos um item, quantidade `> 0`, custo `>= 0`. Mensagens em português junto do campo.
- **Confirmar**: `confirmar()` do `FeedbackContext` com resumo ("Dar entrada de 3 itens? O estoque será aumentado."). O botão trava com `useEnvio` (duplo toque faz uma só chamada).
- **Chave de idempotência**: gerar **uma por tentativa** com o helper `gerarChaveIdempotencia()` (ver abaixo) e **reaproveitá-la** em novo envio depois de falha de rede ou timeout; **trocar** a chave quando o usuário muda qualquer item. Assim, reenviar não soma duas vezes.
- Resposta `201`/`200` (`reaproveitado`): tela de resultado com cada item "saldo 10 → 34", `avisos` em destaque (ex.: custo 10× fora do normal) e botão "Voltar ao estoque". `reaproveitado: true` mostra "Esta entrada já tinha sido registrada." (sem alarme).
- Erros: `404` (insumo apagado: mostra qual e mantém o formulário), `409` (mesma chave com conteúdo diferente: gerar chave nova e orientar a conferir o estoque), `400` (mensagem do backend), rede (mantém tudo e a chave).
- Depois do sucesso, o Estoque recarrega os insumos.
- Aviso permanente no rodapé da tela: "Se a nota fiscal aparecer depois, não importe de novo: o sistema não consegue ver que é a mesma compra."

### Helper `gerarChaveIdempotencia()` (em `frontend/src/lib/`)
- Usa `crypto.randomUUID()` quando existir; **cai para `crypto.getRandomValues`** quando não existir, porque `randomUUID` só está disponível em contexto seguro (HTTPS/localhost) e o app é testado no celular por `http://IP` na rede local.
- Retorna 36 caracteres (cabe nos 8..100 do backend). Teste com `randomUUID` ausente.
- Será reaproveitado pelas tarefas [13](13-fechamento-dia-confirmacao-e-estorno.md).

## Teste que deve falhar antes
- O botão abre a tela; adicionar 2 linhas e enviar chama `POST /estoque/entradas-manuais` com `itens`, `observacao` e `chaveIdempotencia` (8..100 caracteres).
- Quantidade com vírgula ("1,5") vira `1.5`; alternar para kg converte para gramas no payload ("2" kg → `2000`).
- Insumo já usado fica desabilitado no seletor; lista vazia ou quantidade `<= 0` não envia e mostra mensagem.
- Duplo clique em "Dar entrada" faz **uma** chamada; falha de rede e novo toque reenviam **a mesma chave**; editar um item gera chave nova.
- Resposta com `avisos` exibe os avisos; `reaproveitado: true` mostra a mensagem neutra; `404` mostra o insumo e mantém o formulário.
- `gerarChaveIdempotencia()` funciona sem `crypto.randomUUID` (stub do ambiente) e devolve valores diferentes a cada chamada.
- Sucesso recarrega a lista do Estoque.

## Critério de pronto
- [ ] Testes novos verdes e nenhum antigo quebrado; `lint`, `test` e `build` verdes.
- [ ] Conferido no navegador (claro, escuro, 375px) **e no celular por `http://IP` e por `https://IP`**, com dados reais; captura e **medição da cor de fundo** de cada PNG.
- [ ] Linha marcada `FEITA (#PR)` no README e arquivo movido para `realizadas/`.

## Fora do escopo
Ajuste de inventário (tarefa BACK 14, bloqueada), histórico por insumo ([16](16-historico-movimentacoes.md)), detecção de duplicidade com nota importada depois, mudanças no backend.
