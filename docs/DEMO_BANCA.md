# Modo apresentação (banca): banco de demonstração com dados fictícios

O app de produção começa **vazio de movimento**: o seed (`npx prisma db seed`) cadastra só o catálogo real
da loja (49 insumos, receitas da casa e os 22 itens do cardápio com ficha técnica) com **estoque e estoque
mínimo zerados**, e a loja faz a primeira contagem pelo app.

Para apresentar o sistema funcionando, use um **banco separado** com ~30 dias de movimento fictício. O
código do app é o mesmo; só muda o banco para o qual o backend aponta. O banco de produção nunca é tocado.

## O que o seed de demonstração cria

- O mesmo catálogo real (insumos, receitas e cardápio), com estoque mínimo calculado pelo consumo.
- 3 usuários, todos com a senha `demo1234` (ou o valor de `SEED_DEMO_SENHA`):
  - `admin@demo.burguerhouse.com.br` (ADMIN: pode tudo)
  - `gerente@demo.burguerhouse.com.br` e `operador@demo.burguerhouse.com.br` (só leem)
- 30 dias de movimento **fictício**, feito pelos mesmos serviços que o app usa:
  - contagem inicial do estoque;
  - compras por nota fiscal às quartas e sábados, de 3 fornecedores fictícios;
  - produção da maionese, cebola caramelizada, mussarela empanada e crispy de mandioca;
  - fechamento do dia de quarta a domingo (segunda e terça a loja fica fechada);
  - algumas perdas.
- Alertas para mostrar: insumos abaixo do mínimo, a mussarela empanada vencendo amanhã e 2 vendas
  retidas do webhook (um produto que não existe no cardápio e o CHICKEN HOUSE, que está sem ficha).
- **O dia de hoje fica sem fechamento**, para fazer o "Fechar o dia" ao vivo.

Os números saem de um sorteio com semente fixa: rodar de novo no mesmo dia dá o mesmo resultado.
As datas são relativas a hoje, então rode o seed no dia da apresentação (ou na véspera).

## Como preparar (uma vez, no computador da apresentação)

1. Suba o Postgres de desenvolvimento (`docker compose up -d`) e crie o banco de demonstração:
   ```bash
   docker compose exec postgres psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE DATABASE burguer_house_demo"
   ```
   (`DB_USER` e `DB_NAME` são os do `.env` da raiz; o nome do banco **precisa ter "demo"**.)
2. Monte a URL do banco de demonstração: é a mesma `DATABASE_URL` do `backend/.env` trocando o nome do
   banco por `burguer_house_demo`. Nos comandos abaixo ela aparece como `URL_DEMO`.
3. Crie as tabelas e gere os dados (dentro de `backend/`):
   ```bash
   DATABASE_URL="URL_DEMO" npx prisma migrate deploy --config prisma7.config.ts
   DATABASE_URL="URL_DEMO" npm run seed:demo
   ```

## No dia da apresentação

1. Atualize as datas: `DATABASE_URL="URL_DEMO" npm run seed:demo` (apaga e gera de novo).
2. Suba o backend apontando para o banco de demonstração (dentro de `backend/`):
   ```bash
   DATABASE_URL="URL_DEMO" npm run dev
   ```
3. Suba o frontend (`npm --prefix frontend run dev`) e entre com `admin@demo.burguerhouse.com.br`.
4. Sugestão de roteiro: Início (alertas e vendas retidas) → Estoque (abas, estoque mínimo, validade) →
   Relatórios (mês) → Fechar o dia ao vivo → Perdas → entrar como `operador@...` para mostrar o modo
   somente leitura.

## Segurança

- O seed de demonstração **apaga tudo** antes de gerar os dados. Por isso ele se recusa a rodar se o nome
  do banco não tiver "demo" ou se `NODE_ENV=production` (`backend/prisma/banco_demo.ts`).
- Os usuários de demonstração existem só nesse banco. Não use as senhas deles em produção.
