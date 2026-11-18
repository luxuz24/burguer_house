# Deploy: backend no Render, banco no Neon e frontend no Render (plano grátis)

Para o piloto em produção com tudo **manual** (o webhook da Anota AI ainda não está ativo).

| Parte | Onde | Observação |
|---|---|---|
| Banco | Neon, plano Free | Não expira. Dorme depois de 5 min sem uso e acorda em menos de 1 s |
| Backend | Render, Web Service Free | Dorme depois de 15 min sem acesso: o primeiro acesso depois disso leva cerca de 1 minuto |
| Frontend | Render, Static Site | Não dorme. HTTPS incluído (necessário para a câmera do leitor de QR) |

> **Não use o Postgres grátis do Render** para a loja: ele expira 30 dias depois de criado e é apagado
> se não for pago. O estoque real ficaria lá.

Tempo estimado: 40 minutos. Você vai precisar de acesso ao repositório no GitHub e de um terminal no seu
computador com o projeto clonado (`git pull` em dia).

---

## 1. Banco no Neon

1. Crie a conta em <https://neon.com> e um projeto, por exemplo `burguer-house`.
   - **Região:** `AWS US East (N. Virginia)`. Fica perto do servidor do Render (passo 2), e isso importa
     mais do que ficar perto da loja, porque cada tela faz várias consultas ao banco.
   - Versão do Postgres: a padrão.
2. Em **Connect**, copie a connection string **sem pooling** (desligue "Connection pooling"; o host
   não pode ter `-pooler`). Ela tem este formato:
   ```
   postgresql://USUARIO:SENHA@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Nos passos seguintes ela é chamada de `URL_NEON`. Guarde-a num gerenciador de senhas: ela dá acesso
   total ao banco.
   - Se o texto copiado tiver `&channel_binding=require` no fim e a conexão falhar, apague esse trecho.

## 2. Gerar os segredos

No seu terminal, gere dois segredos diferentes (um para o JWT e um para o cron) e um terceiro para o
webhook, que fica guardado para quando a Anota AI entrar:
```bash
openssl rand -hex 32
```
Defina também a **senha do administrador** da loja (`SEED_ADMIN_PASSWORD`). Use uma senha forte: ela é a
conta que pode alterar tudo.

## 3. Criar as tabelas e o catálogo (da sua máquina)

O seed precisa rodar uma vez, do seu computador, apontando para o Neon. Dentro de `backend/`:
```bash
npm ci
```
```bash
DATABASE_URL="URL_NEON" npx prisma migrate deploy --config prisma7.config.ts
```
```bash
DATABASE_URL="URL_NEON" NODE_ENV=production SEED_ADMIN_PASSWORD="SENHA_DO_ADMIN" npx prisma db seed --config prisma7.config.ts
```
O `DATABASE_URL` da linha de comando tem prioridade sobre o do seu `.env`: o banco de desenvolvimento não
é tocado. O seed deve terminar com "Insumos: 49 criados ... Produtos: 22 criados" e "Seed concluído".
Ele cria o catálogo real com estoque **zerado** e o usuário administrador
`gerente@burguerhouse.com.br` com a senha que você definiu.

O seed não apaga nada e pode rodar de novo sem duplicar.
**Nunca** rode `npm run seed:demo` nem `prisma migrate reset` apontando para o Neon (o `seed:demo` se recusa,
o `migrate reset` apaga tudo).

## 4. Backend no Render

1. Crie a conta em <https://render.com> entrando com o GitHub e autorize o acesso ao repositório.
2. **New > Web Service**, escolha o repositório e preencha:

   | Campo | Valor |
   |---|---|
   | Name | `burguer-house-api` (vira `https://burguer-house-api.onrender.com`) |
   | Region | **Virginia (US East)**, a mesma região do Neon |
   | Branch | `main` |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy --config prisma7.config.ts && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | Free |

   - `--include=dev` é necessário: `prisma`, `tsx` e `typescript` são dependências de desenvolvimento, e
     sem elas o build quebra quando `NODE_ENV=production` está definido.
   - O `migrate deploy` no build aplica migrations novas a cada deploy (o plano grátis não tem
     "pre-deploy command"). Se não houver migration nova, ele não faz nada.
3. Em **Environment Variables**:

   | Variável | Valor |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `URL_NEON` |
   | `JWT_SECRET` | segredo 1 do passo 2 |
   | `CRON_SECRET` | segredo 2 do passo 2 |
   | `ANOTAAI_WEBHOOK_SECRET` | segredo 3 do passo 2 |
   | `TRUST_PROXY` | `1` |
   | `CORS_ORIGINS` | deixe para o passo 6 (a URL do frontend ainda não existe) |

   Não defina `PORT`: o Render define sozinho e o servidor já lê essa variável.
   Não coloque `SEED_ADMIN_PASSWORD` aqui: ela só é usada pelo seed, que você rodou no passo 3.
4. Em **Health Check Path**, coloque `/health`.
5. Clique em **Create Web Service** e acompanhe o log. No fim deve aparecer "Server listening".
   Teste no navegador: `https://burguer-house-api.onrender.com/health` deve responder
   `"status":"ok"` e "Banco e API respondendo".

## 5. Frontend no Render (Static Site)

1. **New > Static Site**, mesmo repositório:

   | Campo | Valor |
   |---|---|
   | Name | `burguer-house` (vira `https://burguer-house.onrender.com`) |
   | Branch | `main` |
   | Root Directory | `frontend` |
   | Build Command | `npm ci && npm run build` |
   | Publish Directory | `dist` |

2. **Environment Variables**: `VITE_API_URL` = `https://burguer-house-api.onrender.com` (a URL do backend,
   **sem** `/api` e sem barra no fim). A variável é lida no build: se mudar, faça um novo deploy.
3. Em **Redirects/Rewrites**, adicione: Source `/*`, Destination `/index.html`, Action **Rewrite**.
4. Crie o site e espere o deploy.

## 6. Ligar o frontend ao backend (CORS)

No Web Service do backend, em **Environment**, defina `CORS_ORIGINS` com a URL do frontend, sem barra no
fim, por exemplo `https://burguer-house.onrender.com`. Salve; o Render reinicia o backend.

Sem isso o navegador bloqueia as chamadas e o login falha com erro de rede.

## 7. Aquecimento antes do expediente (cron do GitHub)

Para a primeira pessoa do dia não esperar o minuto do backend acordando, o workflow
`.github/workflows/cron.yml` chama `/health` às 16:50 de Campo Grande (17:50 de Brasília), de quarta a domingo. Ele
tenta de novo até 5 vezes e espera até 120 s, então aguenta o tempo de acordar.

No GitHub, em **Settings > Secrets and variables > Actions**:
- **Secrets**: `API_URL` = `https://burguer-house-api.onrender.com` (sem barra no fim) e
  `CRON_SECRET` = o mesmo segredo 2 do Render.
- **Variables**: `CRON_ATIVO` = `true` (crie por último, depois de tudo no ar).

Teste na aba **Actions > "Cron (aquecimento e consolidação)" > Run workflow**, tarefa `aquecimento`: deve
terminar verde.
O mesmo workflow também roda a consolidação das vendas do webhook às 22:15 de Campo Grande. Sem a Anota AI não há venda
para consolidar e ela termina sem fazer nada.
**Quando a Anota AI entrar:** a loja fecha depois das 23h, então mova esse horário para depois do fechamento
(por exemplo, 03:00 de Campo Grande = `0 7 * * 1,4-6,0` em UTC, ajustando os dias da semana). Senão os pedidos
do fim da noite ficam para a consolidação do dia seguinte.

Se o horário de abertura for outro, ajuste o `cron` do job `aquecimento` (o horário no arquivo é UTC;
Campo Grande é UTC−4, sem horário de verão).

## 8. Primeiro acesso da loja

1. Abra a URL do frontend no celular e entre com `gerente@burguerhouse.com.br` e a senha do passo 2.
2. Em **Perfil**, troque o nome e o telefone do administrador.
3. Em **Estoque > Contagem**, lance o estoque inicial de cada insumo e, no cadastro de cada um, o estoque
   mínimo (começam zerados).
4. Confira as pendências da planilha: o CHICKEN HOUSE e a "Carne seca com requeijão" estão sem ficha e
   sem receita.
5. Se precisar de mais usuários, crie em **Configurações > Usuários**. Por enquanto, GERENTE e OPERADOR só
   consultam: alterações são feitas pelo administrador.
6. Teste o leitor de QR code com uma nota fiscal de verdade (até hoje só a importação por XML foi validada
   com nota real).

## Conferência final

- [ ] `https://burguer-house-api.onrender.com/health` responde `ok`.
- [ ] Login funciona pelo celular, em HTTPS.
- [ ] A câmera abre no leitor de QR code.
- [ ] Uma contagem de estoque aparece no histórico do insumo.
- [ ] Um "Fechar o dia" de teste baixa o estoque pelas fichas. Depois, desfaça-o pelo "Desfazer" na lista
      do dia.
- [ ] O workflow de aquecimento termina verde.

## Dia a dia

- **Fechar o dia:** é feito pela dona (ADMIN) no fim do expediente, depois das 23h. Se for depois da
  meia-noite, até as 5:59 a tela já sugere o dia anterior; confira a data por extenso embaixo do campo antes
  de confirmar. Se o app ficou mais de 15 minutos sem uso, a primeira tela pode levar cerca de 1 minuto.
- **Deploy:** cada merge na `main` faz o Render publicar backend e frontend de novo, aplicando as
  migrations novas.
- **Primeiro acesso lento:** depois de 15 minutos sem uso, o backend leva cerca de 1 minuto para acordar.
  Se isso atrapalhar, o plano pago mais barato do Render deixa o backend sempre ligado; o banco pode
  continuar no Neon grátis.
- **Backup:** o plano grátis do Neon guarda um histórico curto para restauração. Para guardar uma cópia,
  rode de vez em quando, com o PostgreSQL client instalado:
  ```bash
  pg_dump "URL_NEON" -Fc -f burguer_house_$(date +%F).dump
  ```
- **Limite de login:** são 10 tentativas por IP a cada 15 minutos. Os aparelhos da loja costumam sair pelo
  mesmo IP; se alguém errar a senha muitas vezes, espere 15 minutos.
- **Senha esquecida:** o administrador redefine a senha dos outros usuários em **Configurações > Usuários**.
