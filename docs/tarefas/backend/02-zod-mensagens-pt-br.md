# 02 — Mensagens de validação do Zod em inglês

- **Tipo:** fix · **Estado:** PENDENTE
- **Origem:** `docs/requests.md` → "[Backend / Zod] Mensagens de Validação em Português" (achado A3 do frontend, 09/11/2026)
- **Arquivos:** `backend/src/infra/http/app.ts` (ou um módulo de bootstrap importado por ele),
  `backend/src/infra/http/error_handler.ts` (só leitura), `backend/src/infra/http/app.spec.ts`
- **Branch sugerida:** `fix/backend-zod-pt-br`

## Contexto
Os controllers validam com Zod (`zod ^4.6.7`) e o `error_handler.ts` devolve `400` com `issues`. O
frontend mostra `issues[0].message` prefixado pelo nome do campo. O Zod 4 instalado traz os locales
`z.locales.pt` e `z.locales.ptBR` (conferido em `backend/node_modules/zod`).

## Problema
O texto chega em inglês para o usuário final: `Too small: expected number to be >=0`,
`Invalid input: expected number, received string`.

## Comportamento esperado
- `z.config(z.locales.ptBR())` executado **uma vez**, antes de qualquer schema ser usado, no ponto de
  entrada do app (importado por `app.ts`, para valer também nos testes que montam o app sem o `server.ts`).
- Mensagens customizadas que já existem nos schemas (ex.: "Nome é obrigatório") continuam vencendo.
- Formato da resposta 400 não muda (só o texto). Confira em `docs/api.md` se algum exemplo de erro mostra
  texto em inglês e atualize no mesmo commit.

## Teste que deve falhar antes
Em `app.spec.ts` (ou spec HTTP de um controller, ex.: `cadastros.http.spec.ts`):
- `POST /api/insumos` com `estoqueMinimo: -1` → 400 e `issues[0].message` **em português**
  (ex.: contém "maior" ou "≥"/"mínimo", sem "Too small"). Hoje falha.
- Tipo errado (`"abc"` em campo numérico) → mensagem em português.
- Um campo com mensagem customizada continua com a mensagem customizada (regressão).

## Critério de pronto
- [ ] Testes falhando antes (saída no PR) e passando depois.
- [ ] Nenhuma dependência alterada (o locale já vem no pacote).
- [ ] Build e testes verdes; entrada do `requests.md` marcada RESOLVIDO.

## Fora do escopo
Traduzir mensagens que não vêm do Zod (`message` dos controllers já estão em português).
