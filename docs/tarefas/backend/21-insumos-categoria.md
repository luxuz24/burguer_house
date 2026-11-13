# 21 — Categoria em Insumos: filtro, cadastro e alertas

- **Tipo:** feat · **Estado:** PENDENTE (schema pronto na Fase 2 — `CategoriaInsumo`)
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

## Teste que deve falhar antes
- `POST /api/insumos` com `categoria: 'BEBIDA'` grava e retorna `categoria: 'BEBIDA'`; omitindo `categoria`, assume `'INGREDIENTE'`; com valor inválido (`'OUTRA'`), retorna `400`.
- `GET /api/insumos` (sem filtro) retorna itens das três categorias; `GET /api/insumos?categoria=EMBALAGEM` retorna apenas embalagens; `?categoria=INVALIDA` retorna `400`.
- `PUT /api/insumos/:id` altera `categoria` de `'INGREDIENTE'` para `'EMBALAGEM'`.
- Insumo da categoria `BEBIDA` ou `EMBALAGEM` abaixo do `estoqueMinimo` continua entrando nos alertas de estoque mínimo do dashboard.

## Critério de pronto
- [ ] Testes falhando antes (RED) e passando depois (GREEN) no banco `_test`, mais teste de mutação (`>= 85%`) no serviço de escrita tocado.
- [ ] `npm --prefix backend run build` e `npm --prefix backend test` verdes.
- [ ] `docs/api.md` atualizado no mesmo commit; linha desta tarefa marcada como `FEITA (#PR)` na tabela do README.

## Fora do escopo
Alterar `schema.prisma` ou criar abas no frontend (coberto pelas tarefas da Fase 4).
