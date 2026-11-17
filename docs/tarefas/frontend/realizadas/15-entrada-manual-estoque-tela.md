# 15 — Entrada manual de estoque (nota fiscal perdida)

- **Tipo:** feat · **Fase:** 4 · **Estado:** FEITA (#119)
- **Origem:** Pedido da hamburgueria: poder dar entrada no estoque quando perdem a nota fiscal
- **Depende de:** backend [23](../../backend/realizadas/23-entrada-manual-estoque.md) (`POST /api/estoque/entradas-manuais`); frontend [10](10-estoque-abas-por-categoria.md)
- **Arquivos:** `frontend/src/pages/Estoque.tsx` (botão no cabeçalho, ao lado de "Importar nota"), `frontend/src/pages/EntradaManual.tsx`, `frontend/src/lib/entradaManual.ts`, `frontend/src/lib/chaveIdempotencia.ts` (reaproveitado), `EntradaManual.spec.tsx`, `entradaManual.spec.ts` e `Estoque.spec.tsx`
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
> **Já existe** (criado na tarefa 13, #110): `frontend/src/lib/chaveIdempotencia.ts`, com `crypto.randomUUID`, `getRandomValues` e testes. **Reutilize-o; não crie outro.**
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
- [x] Testes novos verdes e nenhum antigo quebrado; `lint`, `test` e `build` verdes (40 arquivos, 710 testes; TDD: 12 falhas no RED antes da implementação).
- [x] Conferido no navegador (claro `#fff9f3`, escuro `#0f0f11`, 375×812 e 1280×800) por `http://192.168.100.14:5174` (`isSecureContext: false`, `crypto.randomUUID` ausente) e `https://192.168.100.14:5174` (`isSecureContext: true`, `crypto.randomUUID` presente), com backend real e banco de dev (`burguer_house`), via emulação mobile no Google Chrome (aparelho físico não verificado); 11 capturas e medições de cor de fundo salvas em [`evidencias-15/`](evidencias-15/).
- [x] Linha marcada `FEITA (#119)` no README e arquivo movido para `realizadas/`.

## Evidências visuais ([`evidencias-15/`](evidencias-15/))
| Captura | Contexto / Viewport | Tema | Cor medida em (20, 20) | Status |
|---|---|---|---|---|
| [`01_estoque_cabecalho_375_claro.png`](evidencias-15/01_estoque_cabecalho_375_claro.png) | `http://192.168.100.14:5174` · 375×812 | Claro | `#fff9f3` (`rgb(255, 249, 243)`) | ✅ |
| [`02_estoque_cabecalho_1280_claro.png`](evidencias-15/02_estoque_cabecalho_1280_claro.png) | `http://192.168.100.14:5174` · 1280×800 | Claro | `#f3f4f6` (`rgb(243, 244, 246)`, fundo externo desktop) | ✅ |
| [`03_entrada_manual_form_375_claro.png`](evidencias-15/03_entrada_manual_form_375_claro.png) | `http://192.168.100.14:5174` · 375×812 | Claro | `#fff9f3` (`rgb(255, 249, 243)`) | ✅ |
| [`04_entrada_manual_form_1280_claro.png`](evidencias-15/04_entrada_manual_form_1280_claro.png) | `http://192.168.100.14:5174` · 1280×800 | Claro | `#f3f4f6` (`rgb(243, 244, 246)`, fundo externo desktop) | ✅ |
| [`05_estoque_cabecalho_375_escuro.png`](evidencias-15/05_estoque_cabecalho_375_escuro.png) | `http://192.168.100.14:5174` · 375×812 | Escuro | `#0f0f11` (`rgb(15, 15, 17)`) | ✅ |
| [`06_entrada_manual_form_375_escuro.png`](evidencias-15/06_entrada_manual_form_375_escuro.png) | `http://192.168.100.14:5174` · 375×812 | Escuro | `#0f0f11` (`rgb(15, 15, 17)`) | ✅ |
| [`07_confirmacao_dialogo_375_escuro.png`](evidencias-15/07_confirmacao_dialogo_375_escuro.png) | `http://192.168.100.14:5174` · 375×812 | Escuro (modal backdrop) | `#696868` (`rgb(105, 104, 104)`) | ✅ |
| [`08_resultado_avisos_375_escuro.png`](evidencias-15/08_resultado_avisos_375_escuro.png) | `http://192.168.100.14:5174` · 375×812 | Escuro | `#0f0f11` (`rgb(15, 15, 17)`) | ✅ |
| [`09_https_entrada_manual_375_claro.png`](evidencias-15/09_https_entrada_manual_375_claro.png) | `https://192.168.100.14:5174` · 375×812 | Claro | `#fff9f3` (`rgb(255, 249, 243)`) | ✅ |
| [`10_https_resultado_375_claro.png`](evidencias-15/10_https_resultado_375_claro.png) | `https://192.168.100.14:5174` · 375×812 | Claro | `#fff9f3` (`rgb(255, 249, 243)`) | ✅ |
| [`11_https_entrada_manual_375_escuro.png`](evidencias-15/11_https_entrada_manual_375_escuro.png) | `https://192.168.100.14:5174` · 375×812 | Escuro | `#0f0f11` (`rgb(15, 15, 17)`) | ✅ |

## Fora do escopo
Ajuste de inventário (tarefa BACK 14, bloqueada), histórico por insumo ([16](16-historico-movimentacoes.md)), detecção de duplicidade com nota importada depois, mudanças no backend.
