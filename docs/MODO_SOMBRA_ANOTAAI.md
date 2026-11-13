# Guia Operacional — Modo Sombra do Webhook Anota AI

Use este fluxo durante os 7 dias de teste da integração com a Anota AI para validar o formato real dos payloads antes de liberar a baixa automática no estoque.

## 1. Ligar o modo sombra em produção/homologação
Defina a variável de ambiente no serviço da API (Koyeb/Render):
```env
ANOTAAI_MODO_SOMBRA=true
```
Com isso ativo:
- `POST /api/webhook/anota-ai` continua validando `ANOTAAI_WEBHOOK_SECRET` e gravando o `payloadOriginal` na tabela `vendas` (deduplicando por `externalId`).
- Cada evento gera um log nível `info` apenas com metadados operacionais (`modoSombra`, `externalId`, `check`, `totalItens`), **sem dados pessoais do cliente**.
- `POST /api/vendas/consolidar` executa em *dry-run*: calcula o plano completo e devolve `modoSombra: true` com `plano.descontosPrevistos`, **sem alterar estoque nem marcar `processado = true`**.

## 2. Coletar eventos reais durante o período de teste
Deixe a loja operar normalmente com o webhook conectado. Confira os logs de recebimento e as respostas do cron (`modoSombra: true`).

## 3. Exportar fixtures anonimizadas
No ambiente com acesso ao banco de coleta (somente leitura na exportação):
```bash
npm --prefix backend run exportar:fixtures
```
Os payloads serão gravados em `backend/src/modules/vendas/fixtures/anotaai/exportadas/` com **somente campos permitidos; texto livre removido** (`observation` e `note` são substituídos por `"<observacao-removida>"`, e campos fora da allowlist são descartados). Revise os arquivos gerados antes de versionar qualquer fixture.

## 4. Validar no adaptador e rodar replay offline
1. Execute `npm --prefix backend run replay:vendas` para inspecionar produtos não mapeados, itens inválidos, colisões e projeção de estoque.
2. Caso o formato real tenha diferenças em relação à API oficial de parceiros (`info.items[].{name,quantity,price,subItems,observation,externalId}`, `check`, `id`), abra as tarefas de ajuste do adaptador (tarefas 17/18).
3. Cadastre/alinhe os produtos e fichas técnicas pendentes no painel.

## 5. Desligar o modo sombra e consolidar de verdade
> ⚠️ **Atenção:** antes de desligar o modo sombra, alinhe com o dono se os pedidos coletados durante os dias de sombra devem consolidar agora ou ser marcados como já tratados (caso tenham sido cobertos por fechamento manual).

Quando validado:
```env
ANOTAAI_MODO_SOMBRA=false
```
Na execução seguinte de `POST /api/vendas/consolidar`, a resposta voltará ao formato normal (`modoSombra` ausente) e o estoque passará a ser baixado transacionalmente.
