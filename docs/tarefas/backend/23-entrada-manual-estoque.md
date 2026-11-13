# 23 — Entrada manual de estoque em lote e histórico (`MovimentacaoEstoque`)

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `MovimentacaoEstoque`)
- **Origem:** Pedido da hamburgueria (dar entrada no estoque quando a nota fiscal foi perdida)
- **Arquivos:** `backend/src/modules/insumos/` (ou `movimentacoes/`), `backend/src/infra/http/controllers/`,
  `backend/src/infra/http/routes/`, `docs/api.md`
- **Branch sugerida:** `feat/backend-entrada-manual-estoque`

## Contexto
Hoje o saldo de insumos só aumenta via importação de XML de Nota Fiscal ou produção interna. Quando a loja perde a nota fiscal de uma compra (bebidas, embalagens, hortifrúti etc.), uma compra costuma conter vários itens e precisa dar entrada atômica com trilha de auditoria. A tabela `movimentacoes_estoque` (`MovimentacaoEstoque`, tipo `ENTRADA_MANUAL`) já está disponível no schema.

## Problema
Sem endpoint em lote com atomicidade transacional, incremento atômico de saldo, chave de idempotência obrigatória, validação contra duplicação silenciosa de insumos e alerta de divergência extrema de custo (ex.: R$/kg lançado no lugar de R$/g), uma falha parcial ou erro de unidade corromperia o estoque e os custos médios sem histórico consultável.

## Comportamento esperado
Ambas as rotas exigem autenticação JWT (`401` sem token válido):

1. **`POST /api/estoque/entradas-manuais`**
   - Body Zod:
     - `chaveIdempotencia`: **OBRIGATÓRIA**, `string` de `8` a `100` caracteres (`trim`).
     - `observacao`: opcional, `string` até `500` caracteres.
     - `itens`: array de `1` a `100` itens `{ insumoId: uuid, quantidade: number > 0, custoUnitario?: number >= 0 }`.
     - **Insumo repetido na mesma requisição** → `400` com mensagem clara (NÃO somar silenciosamente).
   - **UMA única transação (`prisma.$transaction`) para todos os itens:**
     - Se qualquer `insumoId` não existir → HTTP `404` para a requisição inteira, sem alterar nenhum item.
   - **Atomicidade do saldo:** usar atualização atômica (`tx.insumo.update({ where, data: { estoqueAtual: { increment: item.quantidade }, ... } })`) e ler o `estoqueAtual` retornado:
     - `saldoPosterior = atualizado.estoqueAtual`
     - `saldoAnterior = saldoPosterior - item.quantidade`
     - Dessa forma, duas entradas simultâneas no mesmo insumo nunca perdem soma.
   - **Registro de auditoria:** criar **uma** `MovimentacaoEstoque` por item com `tipo = 'ENTRADA_MANUAL'`, `usuarioId` do JWT, `quantidade`, `saldoAnterior`, `saldoPosterior`, `custoUnitario` (informado ou `null`), `observacao` e `chaveIdempotencia = "${chaveIdempotencia}:${item.insumoId}"` (porque a coluna `chaveIdempotencia` é `@unique` por linha).
   - **Regra de atualização de custo (cópia exata da entrada por nota fiscal — `entrada_estoque.service.ts:108-111`):**
     - Atualizar `insumo.custoUnitario = item.custoUnitario` **somente quando `item.custoUnitario !== undefined && item.custoUnitario > 0`**.
     - Se `custoUnitario` for omitido (`undefined`) ou igual a `0`, **não sobrescrever** o `custoUnitario` atual do insumo.
   - **Unidade e avisos:** `quantidade` e `custoUnitario` são sempre na **unidade do insumo** (ex.: gramas e R$/g), nunca em kg. Quando `item.custoUnitario > 0`, o custo atual do insumo for `> 0` e o novo custo diferir mais de `10×` do atual (`item.custoUnitario > custoAtual * 10 || item.custoUnitario * 10 < custoAtual`), retornar aviso descritivo em `avisos: [...]` na resposta, **sem bloquear** a entrada.
   - **Idempotência e concorrência:**
     - Primeira execução → HTTP `201`.
     - Mesma `chaveIdempotencia` + mesmo conteúdo → HTTP `200` devolvendo o resultado anterior com `reaproveitada: true`, sem somar novamente.
     - Mesma `chaveIdempotencia` + conteúdo diferente → HTTP `409 Conflict`.
     - Duas requisições simultâneas com a mesma chave: uma aplica e a outra trata a violação de unicidade (`P2002`) como replay (validando equivalência do conteúdo).

2. **`GET /api/estoque/movimentacoes?insumoId=&limite=&offset=`**
   - Lista movimentações das mais novas para as mais antigas (`criadoEm DESC`), com `limite` padrão `50` e máximo `200`, `offset` padrão `0`.
   - Filtro opcional por `insumoId` (UUID válido).
   - Retorna cada movimentação com `insumo` (`nome`, `unidade`) e `usuario` (`nome`), além de `total` para paginação.

### Aviso operacional em `docs/api.md`
- Documentar expressamente em `docs/api.md` que **a entrada manual não detecta duplicidade com uma nota fiscal importada posteriormente** (o sistema não sabe que ambas representam a mesma compra).

## Teste que deve falhar antes
- Sem JWT → `401`.
- `400` para `quantidade <= 0`, `custoUnitario < 0`, `itens` vazio, `insumoId` repetido na mesma requisição ou `chaveIdempotencia` ausente/`< 8` caracteres.
- `404` quando um dos itens tem `insumoId` inexistente, abortando todos os demais (zero alterações no banco).
- Entrada de `+24` leva `estoqueAtual` de `10` para `34` e grava `MovimentacaoEstoque` com `saldoAnterior: 10`, `saldoPosterior: 34`, `tipo: 'ENTRADA_MANUAL'` e `usuarioId` do JWT.
- Lote com 3 insumos grava 3 movimentações coerentes com chaves `<chave>:<insumoId>`.
- Replay idempotente: repetir mesma `chaveIdempotencia` + mesmo conteúdo retorna `200` com `reaproveitada: true` sem somar novamente; mesma chave + conteúdo diferente retorna `409`.
- Concorrência real (`Promise.all`): entradas simultâneas de `5` e `8` sobre saldo `10` terminam exatamente em `23` com cadeia coerente de `saldoAnterior` / `saldoPosterior`; com a mesma chave simultânea aplica uma única vez.
- Custo unitário: atualiza `insumo.custoUnitario` apenas quando `custoUnitario > 0`; quando omitido ou `0`, preserva o custo atual do insumo.
- Aviso de custo: quando novo custo difere `> 10×` do atual (`> 0`), grava normalmente e devolve `avisos` preenchido.
- `GET /api/estoque/movimentacoes` retorna `total`, ordenação da mais nova para a mais antiga, paginação (`limite`/`offset`), filtro por `insumoId`, `insumo.nome`/`unidade` e `usuario.nome`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, incluindo teste de concorrência real e teste de mutação (`>= 85%`) no serviço de escrita (sobreviventes justificados um a um).
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado no mesmo commit (com o aviso sobre NF importada depois); linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Implementar `AJUSTE` de inventário (segue na tarefa `14-ajuste-inventario-estoque.md`), alterar `schema.prisma` ou criar tela no frontend.
