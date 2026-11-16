# 21 — Categoria em Insumos: filtro, cadastro e alertas

- **Tipo:** feat · **Fase:** 3 · **Estado:** FEITA (#99) (schema pronto na Fase 2 — `CategoriaInsumo`)
- **Depende de:** Fase 2 (PR #97). **Primeira da Fase 3** (as demais não dependem dela, mas o frontend sim).
- **Consumida por (frontend):** [10](../frontend/10-estoque-abas-por-categoria.md) e [11](../frontend/11-insumo-categoria-no-cadastro.md)
- **Origem:** Pedido da hamburgueria (abas separadas de Ingredientes, Embalagens e Bebidas no Estoque)
- **Arquivos:** `backend/src/modules/insumos/`, `backend/src/infra/http/controllers/insumos.controller.ts`,
  `backend/src/infra/http/routes/insumos.routes.ts`, `backend/src/modules/dashboard/`, `docs/api.md`
- **Branch sugerida:** `feat/backend-insumos-categoria`

## Contexto
A tabela `insumos` já possui a coluna `categoria` (`INGREDIENTE` | `EMBALAGEM` | `BEBIDA`, padrão `INGREDIENTE`), com todos os insumos iniciais classificados (36 ingredientes, 5 embalagens, 8 bebidas).

## Problema
Os endpoints de `Insumos` ainda não expõem nem validam `categoria` na criação, edição e listagem filtrada, impedindo o frontend de separar Ingredientes, Embalagens e Bebidas em abas próprias sem duplicar regras.

## Comportamento esperado
- `POST /api/insumos`: aceitar `categoria` opcional no body (enum Zod `INGREDIENTE | EMBALAGEM | BEBIDA`; padrão `INGREDIENTE` quando omitido). Rejeitar valores inválidos com `400`.
- `PUT /api/insumos/:id`: aceitar atualização de `categoria` (mesma validação Zod).
- `GET /api/insumos`:
  - Sempre retornar `categoria` em cada item da listagem (e no `GET /api/insumos/:id`).
  - Aceitar query param opcional `?categoria=INGREDIENTE|EMBALAGEM|BEBIDA` para filtrar (`400` se inválido).
  - **Quando `?categoria` não for informado, listar todas as categorias.**
- **Alertas de estoque mínimo:** os alertas de estoque baixo/crítico (no dashboard e listagens) continuam valendo igualmente para as **três** categorias (`INGREDIENTE`, `EMBALAGEM` e `BEBIDA`).
- Atualizar `docs/api.md` com o campo `categoria` e o filtro `?categoria=`.

## Contrato de resposta
`GET /api/insumos` e `GET /api/insumos/:id` passam a incluir `categoria`:
```json
{ "id": "uuid", "nome": "Coca Cola Zero 350ml", "unidade": "Unidade", "categoria": "BEBIDA",
  "estoqueAtual": 100, "estoqueMinimo": 24, "custoUnitario": 3.05, "fatorPerda": 0,
  "produzidoInternamente": false, "validadeDias": null }
```
- `GET /api/insumos/alertas` e `estoqueAlerta` do `GET /api/dashboard/resumo` incluem `categoria` em cada item (o Início usa para agrupar/rotular).
- Valor inválido em `?categoria=` → `400` com `{ "message": "Categoria inválida" }`.
- Mudar a categoria de um insumo **não** altera ficha técnica, estoque nem histórico.
- O filtro não faz paginação (49 insumos); manter a ordenação atual da listagem.

## Teste que deve falhar antes
- `POST /api/insumos` com `categoria: 'BEBIDA'` grava e retorna `categoria: 'BEBIDA'`; omitindo `categoria`, assume `'INGREDIENTE'`; com valor inválido (`'OUTRA'`), retorna `400`.
- `GET /api/insumos` (sem filtro) retorna itens das três categorias; `GET /api/insumos?categoria=EMBALAGEM` retorna apenas embalagens; `?categoria=INVALIDA` retorna `400`.
- `PUT /api/insumos/:id` altera `categoria` de `'INGREDIENTE'` para `'EMBALAGEM'`.
- Insumo da categoria `BEBIDA` ou `EMBALAGEM` abaixo do `estoqueMinimo` continua entrando nos alertas de estoque mínimo do dashboard.

## Critério de pronto
- [x] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, mais teste de mutação (`>= 85%`) no serviço de escrita tocado.
- [x] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [x] `docs/api.md` atualizado no mesmo commit; linha desta tarefa marcada como `FEITA (#99)` na tabela do README e arquivo movido para `realizadas/`.

## Fora do escopo
Alterar `schema.prisma` ou criar abas no frontend (coberto pelas tarefas da Fase 4).
