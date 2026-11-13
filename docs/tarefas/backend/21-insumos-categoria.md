# 21 — Filtro e cadastro de `categoria` em Insumos

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `CategoriaInsumo`)
- **Origem:** Pedido da hamburgueria (abas separadas de Ingredientes, Embalagens e Bebidas no Estoque)
- **Arquivos:** `backend/src/modules/insumos/`, `backend/src/infra/http/controllers/insumos.controller.ts`,
  `backend/src/infra/http/routes/insumos.routes.ts`, `docs/api.md`
- **Branch sugerida:** `feat/backend-insumos-categoria`

## Contexto
A tabela `insumos` já possui a coluna `categoria` (`INGREDIENTE` | `EMBALAGEM` | `BEBIDA`, padrão `INGREDIENTE`), com todos os insumos iniciais classificados (36 ingredientes, 5 embalagens, 8 bebidas).

## Comportamento esperado
- `POST /api/insumos`: aceitar `categoria` opcional no body (enum Zod `INGREDIENTE | EMBALAGEM | BEBIDA`; padrão `INGREDIENTE` quando omitido). Rejeitar valores inválidos com `400`.
- `PUT /api/insumos/:id`: aceitar atualização de `categoria` (mesma validação Zod).
- `GET /api/insumos`:
  - Sempre retornar `categoria` em cada item da listagem (e no `GET /api/insumos/:id`).
  - Aceitar query param opcional `?categoria=INGREDIENTE|EMBALAGEM|BEBIDA` para filtrar (retornar `400` se inválido).
- Atualizar `docs/api.md` com o campo `categoria` e o filtro `?categoria=`.

## Teste que deve falhar antes
- `POST /api/insumos` com `categoria: 'BEBIDA'` grava e retorna `categoria: 'BEBIDA'`; omitindo `categoria`, assume `'INGREDIENTE'`; com valor inválido (`'OUTRA'`), retorna `400`.
- `GET /api/insumos?categoria=EMBALAGEM` retorna apenas embalagens; `?categoria=INVALIDA` retorna `400`.
- `PUT /api/insumos/:id` altera `categoria` de `'INGREDIENTE'` para `'EMBALAGEM'`.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, mais teste de mutação (`>= 85%`) no serviço de escrita tocado.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado no mesmo commit; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma` ou criar abas no frontend (coberto pelas tarefas da Fase 4).
