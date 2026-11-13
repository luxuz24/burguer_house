# Arquitetura do BurgerStock

Visão do que **existe hoje no código** (branch `main`). A hospedagem em nuvem aparece como *planejada*, porque o `PLANO.md` a prevê mas ainda não há deploy configurado. Os diagramas estão em Mermaid: o GitHub e o Obsidian os desenham sozinhos.

> Mudou código que altera um diagrama? Atualize este arquivo no mesmo PR. O contrato das rotas fica em [api.md](api.md).

## 1. Contexto: quem fala com quem

```mermaid
flowchart LR
    dono["Dono e equipe da loja<br/>(celular)"]

    subgraph app["BurgerStock"]
        front["Frontend<br/>React + Vite"]
        api["API<br/>Fastify + Zod"]
        db[("PostgreSQL<br/>via Prisma")]
    end

    anota["Anota AI<br/>(pedidos)"]
    sefaz["Portais da SEFAZ<br/>(*.gov.br)"]
    gha["GitHub Actions<br/>(cron)"]

    dono --> front
    front -- "/api + token JWT" --> api
    api --> db
    anota -- "webhook com eventos do pedido" --> api
    api -- "consulta a página do QR code" --> sefaz
    gha -- "aquecimento e consolidação" --> api
```

| Peça | Papel | Observação |
|---|---|---|
| Frontend (`frontend/`) | Telas mobile-first para estoque, perdas, notas e relatórios | Em dev chama `/api` e o Vite repassa ao backend; em produção usa `VITE_API_URL` |
| API (`backend/`) | Regras de negócio, autenticação e acesso ao banco | Escuta na porta de `PORT` (padrão 3000) e encerra de forma limpa em `SIGINT` e `SIGTERM` |
| PostgreSQL | Dados do estoque, vendas, notas e usuários | Schema e migrations em `backend/prisma/` |
| Anota AI | Origem dos pedidos | Chama o webhook; o formato real do corpo ainda não foi confirmado (ver [requests.md](requests.md)) |
| SEFAZ | Página pública da NFC-e lida pelo QR code | Só hosts `*.gov.br`, em https |
| GitHub Actions | CI e agendamentos | Ver seção 7 |

## 2. Backend por dentro

```mermaid
flowchart TB
    req["Requisição HTTP"] --> cors["CORS"]
    cors --> guard["Guard JWT (preParsing)<br/>públicas: /health, login, webhook, consolidar"]
    guard --> rota["Rotas<br/>routes/*.routes.ts"]
    rota --> ctrl["Controllers<br/>validam a entrada com Zod"]
    ctrl --> svc["Serviços com as regras<br/>modules/*/services"]
    ctrl --> repo["Repositories<br/>modules/*/repositories"]
    svc --> repo
    repo --> prisma["Prisma Client + adapter pg<br/>(pool com timeouts)"]
    prisma --> pg[("PostgreSQL")]
    ctrl -. "exceção" .-> erro["Error handler central<br/>Zod 400 · P2025 404 · P2002 e P2003 409 · 500 genérico"]
```

**Rotas** (prefixo `/api`, exceto `/health`):

| Prefixo | O que faz |
|---|---|
| `/auth` | login, perfil, troca de senha (login limitado a 10 tentativas por IP a cada 15 min) |
| `/insumos` | cadastro de insumos e alertas de estoque mínimo |
| `/produtos` e `/fichas-tecnicas` | produtos e a receita (insumos por produto) |
| `/preparo-interno` | sub-fichas e produção de itens beneficiados |
| `/perdas` | registro de perdas e resumo mensal |
| `/notas-fiscais` | leitura de QR code e XML, confirmação da entrada, listagem |
| `/dashboard` | resumo agregado por período |
| `/webhook/anota-ai` e `/vendas/consolidar` | entrada de vendas e baixa de estoque |

**Segurança em uma linha:** tudo exige JWT, exceto `/health`, o login e as duas rotas com segredo próprio (`ANOTAAI_WEBHOOK_SECRET` no webhook e `CRON_SECRET` na consolidação). O servidor não sobe sem `JWT_SECRET`.

## 3. Modelo de dados

```mermaid
erDiagram
    PRODUTO ||--o{ FICHA_TECNICA : "tem"
    INSUMO ||--o{ FICHA_TECNICA : "entra em"
    INSUMO ||--o{ PERDA : "sofre"
    INSUMO ||--o{ SUB_FICHA_TECNICA : "beneficiado (feito na casa)"
    INSUMO ||--o{ SUB_FICHA_TECNICA : "bruto (ingrediente)"
    NOTA_FISCAL ||--o{ ITEM_NOTA_FISCAL : "contém"
    INSUMO |o--o{ ITEM_NOTA_FISCAL : "vinculado a"

    INSUMO {
        string id PK
        string nome
        string unidade
        float fatorPerda
        float custoUnitario
        float estoqueAtual
        float estoqueMinimo
        boolean produzidoInternamente
        int validadeDias
    }
    PRODUTO {
        string id PK
        string nome
    }
    FICHA_TECNICA {
        string id PK
        string produtoId FK
        string insumoId FK
        float quantidade
    }
    SUB_FICHA_TECNICA {
        string id PK
        string insumoBeneficiadoId FK
        string insumoBrutoId FK
        float quantidadeNecessaria
    }
    PERDA {
        string id PK
        string insumoId FK
        float quantidade
        string motivo
    }
    NOTA_FISCAL {
        string id PK
        string chaveAcesso UK
        string fornecedorNome
        string fornecedorCnpj
        float valorTotal
        datetime dataEmissao
    }
    ITEM_NOTA_FISCAL {
        string id PK
        string notaFiscalId FK
        string insumoId FK
        string descricaoOriginal
        float quantidadeConvertida
    }
    VENDA {
        string id PK
        string externalId UK
        json payloadOriginal
        boolean processado
    }
    USUARIO {
        string id PK
        string email UK
        string senha
        string role
        boolean ativo
    }
```

- `VENDA` guarda o payload bruto da Anota AI e não se liga às outras tabelas: a ligação é feita **na consolidação**, pelo nome do produto vendido.
- `motivo` da perda: `VENCIMENTO`, `ERRO_PREPARO`, `ESTRAGADO` ou `OUTRO`. `role` do usuário: `ADMIN`, `GERENTE` ou `OPERADOR` (as permissões por role ainda não são aplicadas).
- A `chaveAcesso` única da nota é o que impede importar a mesma nota duas vezes.
- Só os campos principais estão no diagrama; a lista completa está em `backend/prisma/schema.prisma`.

## 4. Fluxos principais

### 4.1 Venda: do pedido ao estoque

```mermaid
sequenceDiagram
    autonumber
    participant A as Anota AI
    participant W as API (webhook)
    participant D as Banco (vendas)
    participant C as Cron (GitHub Actions)
    participant S as API (consolidar)
    participant I as Banco (insumos)

    A->>W: POST /api/webhook/anota-ai (segredo + evento do pedido)
    W->>D: grava, ou atualiza a venda pendente do mesmo pedido (externalId)
    W-->>A: 200 (só depois de gravar)
    Note over A,W: aceito, atualizado e cancelado chegam como eventos do MESMO pedido
    C->>S: POST /api/vendas/consolidar (x-cron-secret)
    S->>D: lê as vendas pendentes e classifica pelo estado (check)
    Note over S,D: 1,2,3 abatem · 4,5,-4,41,42 descartam · 0,-2,-1,-3,6 ficam pendentes
    S->>D: reivindica as vendas (id + atualizadoEm)
    S->>I: abate o estoque pela ficha técnica (com fator de perda)
    S-->>C: resumo da consolidação
```

Por que é assim:
- O webhook **grava antes de responder**: se o banco falhar, devolve 500 e a Anota AI pode reenviar.
- Como o mesmo pedido gera vários eventos, o **último estado vale** enquanto a venda não foi consolidada.
- A consolidação **reivindica** as vendas dentro da transação: duas execuções simultâneas não descontam o estoque em dobro, e um cancelamento que chegue no meio faz a leitura ser refeita.
- Com `ANOTAAI_MODO_SOMBRA=true`, o webhook registra os eventos com log operacional livre de PII e `POST /api/vendas/consolidar` roda apenas o planejamento em *dry-run* (`modoSombra: true`), sem abater estoque nem marcar `processado`. O script `npm --prefix backend run exportar:fixtures` exporta esses payloads anonimizados para validação com `replay:vendas`. Ver guia completo em [MODO_SOMBRA_ANOTAAI.md](MODO_SOMBRA_ANOTAAI.md).

### 4.2 Nota fiscal: da compra ao estoque

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant F as Frontend
    participant A as API
    participant S as SEFAZ (*.gov.br)
    participant B as Banco

    alt QR code da NFC-e
        U->>F: escaneia o QR code
        F->>A: POST /api/notas-fiscais/parser-qrcode
        A->>S: GET da página pública (https, só *.gov.br, IP público)
        S-->>A: HTML da nota
        A->>A: extrai os itens e sugere o insumo de cada um
    else Upload do XML
        U->>F: envia o XML da NF-e
        F->>A: POST /api/notas-fiscais/parser-xml
        A->>A: extrai os itens e sugere o insumo de cada um
    end
    A-->>F: itens sugeridos, com a confiança do vínculo
    U->>F: confere e ajusta os vínculos
    F->>A: POST /api/notas-fiscais/confirmar
    A->>B: transação: soma o estoque, atualiza o custo e grava a nota
    A-->>F: 200, ou 409 se a nota já foi importada
```

O vínculo item da nota com insumo tenta, nesta ordem: histórico de vínculos anteriores, nome exato, sinônimos e similaridade por palavras. Se a SEFAZ não responder, o sistema devolve só a chave de acesso e o usuário segue pelo XML ou digita os itens.

### 4.3 Produção interna e perdas

```mermaid
flowchart LR
    subgraph producao["Preparo interno"]
        p1["POST /api/preparo-interno/produzir"] --> p2{"Estoque dos brutos<br/>é suficiente?"}
        p2 -- "sim" --> p3["Abate os brutos (com fator de perda)<br/>e soma no item beneficiado"]
        p2 -- "não" --> p4["409 e nada é alterado"]
    end
    subgraph perda["Perdas"]
        q1["POST /api/perdas"] --> q2["Registra a perda e abate o estoque"]
        q2 --> q3["Se o saldo ficar negativo,<br/>a resposta traz estoqueNegativo"]
    end
```

## 5. Frontend

```mermaid
flowchart TB
    main["main.tsx"] --> app["App.tsx"]
    app --> prov["Providers: Theme, Feedback (avisos), Auth"]
    prov --> auth{"Autenticado?"}
    auth -- "não" --> login["Login"]
    auth -- "sim" --> nav["Header + BottomNav"]
    nav --> inicio["Início"]
    nav --> estoque["Estoque<br/>(abas: insumos e produtos)"]
    nav --> perdas["Perdas"]
    nav --> rel["Relatórios (Dashboard)"]
    nav --> modais["Modais: Perfil e Configurações"]
    inicio --> imp["Importar nota fiscal"]
    estoque --> imp
    estoque --> ficha["Ficha técnica (do produto)"]
    estoque --> prep["Preparo interno (do item beneficiado)"]
    app -. "todas as chamadas" .-> api["lib/api.ts<br/>axios + token JWT + tratamento de 401"]
```

- O token fica no `localStorage`. Um 401 em qualquer chamada encerra a sessão. Erro de rede ao abrir o app **não** derruba a sessão (usa o último usuário salvo).
- `pages/Insumos.tsx` existe, mas **nenhuma tela o importa**: o cadastro de insumos acontece em `Estoque.tsx`.

## 6. Decisões de arquitetura que valem lembrar

| Decisão | Motivo |
|---|---|
| Transações para tudo que mexe em estoque | Duas operações simultâneas não podem corromper o saldo |
| Baixa condicional na produção interna | Se o estoque acabar no meio, tudo é desfeito com 409 |
| Estoque negativo permitido na consolidação e nas perdas | A venda e a perda já aconteceram; o sistema avisa em vez de bloquear |
| `chaveAcesso` única como chave de idempotência da nota | Reimportar a mesma nota não duplica o estoque |
| Validação com Zod nos controllers e erros tratados em um só lugar | Respostas de erro consistentes e sem vazar detalhes internos |
| Cron externo (GitHub Actions) em vez de agendador dentro da API | Em plano gratuito a API hiberna; o agendamento externo a acorda |

## 7. Infraestrutura e CI

```mermaid
flowchart LR
    dev["Pull request"] --> ci["CI (ci.yml)<br/>lint, prisma validate e generate,<br/>build e testes com Postgres"]
    ci --> main["main"]

    subgraph prod["Produção (planejado no PLANO.md)"]
        vercel["Vercel: frontend"]
        koyeb["Koyeb: API"]
        neon[("Neon: PostgreSQL")]
    end

    main -. "deploy (ainda não configurado)" .-> prod
    cron["cron.yml<br/>17:50 BRT: GET /health<br/>23:15 BRT: consolidar<br/>quarta a domingo, só com CRON_ATIVO=true"] --> koyeb
    vercel --> koyeb
    koyeb --> neon
```

- Os horários do `cron.yml` estão em UTC no arquivo (Brasília é UTC-3): 23:15 BRT cai às 02:15 UTC do dia seguinte.
- Variáveis de ambiente por componente estão em `backend/.env.example` e `frontend/.env.example`. Segredos de produção (`JWT_SECRET`, `ANOTAAI_WEBHOOK_SECRET`, `CRON_SECRET`) nunca vão para o Git.
