# Documentação da API - Burguer House

Esta documentação descreve todas as rotas HTTP atualmente implementadas no backend Fastify, baseada na leitura do código real das rotas, controllers e repositórios.

A API roda por padrão na porta `3000` (`http://localhost:3000`). Todas as rotas de domínio utilizam o prefixo `/api`.

> **Autenticação**: todas as rotas exigem `Authorization: Bearer <token>` (JWT), exceto `GET /health`, `POST /api/auth/login`, `POST /api/webhook/anota-ai` e `POST /api/vendas/consolidar` (estes usam segredo próprio, preferencialmente via header; se usar `?token=`, ele é redigido nos logs). Sem token válido → `401`. Autorização por role ainda não é aplicada. Variáveis obrigatórias: `JWT_SECRET` (o servidor não sobe sem ela), `ANOTAAI_WEBHOOK_SECRET`, `CRON_SECRET`.

> **Erros padrão** (tratados centralmente): `400` dados inválidos (`{ message, issues[] }` do Zod, inclusive IDs que não são UUID e JSON malformado); `404` registro inexistente em atualização/remoção; `409` conflito (registro duplicado ou item em uso por outro registro, ex.: insumo vinculado a uma ficha técnica); `401` token ausente/inválido; `429` limite de tentativas de login; `500` erro interno (mensagem genérica, o detalhe só vai para o log). Em `POST/PUT /api/insumos`, `/api/produtos` e `/api/fichas-tecnicas` campos desconhecidos são ignorados; `PUT /api/insumos/:id` aceita atualização parcial.

---

## 1. Saúde da Aplicação (Healthcheck)

### `GET /health`
Verifica se a API e suas dependências básicas estão ativas e respondendo.

- **Método**: `GET`
- **Caminho**: `/health`
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-07T14:00:00.000Z",
    "message": "BurgerStock API - Banco e API respondendo"
  }
  ```
- **Erros**:
  - `500 Internal Server Error`: Caso o servidor Fastify falhe ao processar a requisição.

---

## 2. Insumos (`/api/insumos`)

### `GET /api/insumos`
Lista todos os insumos cadastrados no banco de dados, ordenados alfabeticamente por `nome` em ordem ascendente.

- **Método**: `GET`
- **Caminho**: `/api/insumos`
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  [
    {
      "id": "e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1",
      "nome": "Carne de Hambúrguer",
      "unidade": "Gramas",
      "fatorPerda": 0,
      "estoqueAtual": 5000,
      "estoqueMinimo": 1000,
      "criadoEm": "2026-09-30T02:30:03.000Z",
      "atualizadoEm": "2026-09-30T02:30:03.000Z"
    }
  ]
  ```
- **Erros**:
  - `500 Internal Server Error`: Erro interno ou falha na conexão com o banco de dados.

---

### `GET /api/insumos/alertas`
Lista os insumos cujo estoque atual atingiu ou ficou abaixo do estoque mínimo (`estoqueAtual <= estoqueMinimo`), ordenados por nome.

- **Método**: `GET`
- **Caminho**: `/api/insumos/alertas`
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  [
    {
      "id": "7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f",
      "nome": "Frango Empanado",
      "unidade": "Unidade",
      "fatorPerda": 0,
      "estoqueAtual": 10,
      "estoqueMinimo": 15,
      "criadoEm": "2026-09-30T02:30:03.000Z",
      "atualizadoEm": "2026-09-30T02:30:03.000Z"
    }
  ]
  ```
- **Erros**:
  - `500 Internal Server Error`: Falha ao executar consulta raw no banco de dados.

---

### `POST /api/insumos`
Cadastra um novo insumo no estoque.

- **Método**: `POST`
- **Caminho**: `/api/insumos`
- **Headers**: `Content-Type: application/json`
- **Corpo da Requisição (Body)**:
  ```json
  {
    "nome": "Queijo Prato",
    "unidade": "Unidade",
    "fatorPerda": 0,
    "estoqueAtual": 80,
    "estoqueMinimo": 20
  }
  ```
  - `nome` (*string*, obrigatório): Nome do insumo.
  - `unidade` (*string*, obrigatório): Unidade de medida (ex.: `"Gramas"`, `"Unidades"`, `"Mililitros"`).
  - `fatorPerda` (*number*, opcional, default 0): Fator de perda percentual/decimal.
  - `estoqueAtual` (*number*, obrigatório): Quantidade atual em estoque.
  - `estoqueMinimo` (*number*, obrigatório): Quantidade mínima de segurança.

- **Resposta de Sucesso (201 Created)**:
  ```json
  {
    "id": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
    "nome": "Queijo Prato",
    "unidade": "Unidade",
    "fatorPerda": 0,
    "estoqueAtual": 80,
    "estoqueMinimo": 20,
    "criadoEm": "2026-10-07T14:10:00.000Z",
    "atualizadoEm": "2026-10-07T14:10:00.000Z"
  }
  ```
- **Erros**:
  - `500 Internal Server Error`:
    ```json
    {
      "message": "Erro ao cadastrar insumo"
    }
    ```

---

### `PUT /api/insumos/:id`
Atualiza os dados de um insumo previamente cadastrado.

- **Método**: `PUT`
- **Caminho**: `/api/insumos/:id`
- **Parâmetros de Rota (Params)**:
  - `id` (*string*, obrigatório): UUID do insumo a ser atualizado.
- **Headers**: `Content-Type: application/json`
- **Corpo da Requisição (Body)**:
  ```json
  {
    "nome": "Queijo Prato Especial",
    "unidade": "Unidade",
    "fatorPerda": 0,
    "estoqueAtual": 120,
    "estoqueMinimo": 30
  }
  ```
  *(Campos enviados atualizam o registro; campos omitidos não sofrem alteração).*

- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "id": "d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a",
    "nome": "Queijo Prato Especial",
    "unidade": "Unidade",
    "fatorPerda": 0,
    "estoqueAtual": 120,
    "estoqueMinimo": 30,
    "criadoEm": "2026-10-07T14:10:00.000Z",
    "atualizadoEm": "2026-10-07T14:12:00.000Z"
  }
  ```
- **Erros**:
  - `500 Internal Server Error`:
    ```json
    {
      "message": "Erro ao atualizar o insumo"
    }
    ```
    *(Ocorre se o ID não for encontrado no banco de dados ou em erro de conexão).*

---

### `DELETE /api/insumos/:id`
Remove um insumo do banco de dados pelo seu identificador.

- **Método**: `DELETE`
- **Caminho**: `/api/insumos/:id`
- **Parâmetros de Rota (Params)**:
  - `id` (*string*, obrigatório): UUID do insumo a ser deletado.
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta de Sucesso (204 No Content)**:
  - Sem corpo retornado.
- **Erros**:
  - `500 Internal Server Error`:
    ```json
    {
      "message": "Erro ao deletar o insumo"
    }
    ```
    *(Nota: Devido à restrição `onDelete: Restrict` na tabela `fichas_tecnicas`, a exclusão falhará com erro 500 caso o insumo esteja vinculado à ficha técnica de qualquer produto).*

---

## 3. Produtos (`/api/produtos`)

### `GET /api/produtos`
Lista todos os produtos cadastrados.

- **Método**: `GET`
- **Caminho**: `/api/produtos`
- **Resposta de Sucesso (200 OK)**:
  ```json
  [
    {
      "id": "uuid",
      "nome": "X-Burguer",
      "criadoEm": "2026-10-07T14:10:00.000Z",
      "atualizadoEm": "2026-10-07T14:10:00.000Z"
    }
  ]
  ```

### `GET /api/produtos/:id`
Busca um produto específico pelo ID, incluindo suas Fichas Técnicas e os Insumos associados.

- **Método**: `GET`
- **Caminho**: `/api/produtos/:id`
- **Resposta de Sucesso (200 OK)**: Retorna o produto com `fichasTecnicas` e `insumo`.

### `POST /api/produtos`
Cadastra um novo produto.

- **Método**: `POST`
- **Caminho**: `/api/produtos`
- **Body**:
  ```json
  {
    "nome": "X-Burguer"
  }
  ```

### `PUT /api/produtos/:id`
Atualiza um produto.

### `DELETE /api/produtos/:id`
Deleta um produto (deleta em cascata as fichas técnicas associadas).

---

## 4. Fichas Técnicas (`/api/fichas-tecnicas`)

### `POST /api/fichas-tecnicas`
Vincula um insumo a um produto, definindo a quantidade utilizada.

- **Método**: `POST`
- **Caminho**: `/api/fichas-tecnicas`
- **Body**:
  ```json
  {
    "produtoId": "uuid-do-produto",
    "insumoId": "uuid-do-insumo",
    "quantidade": 150
  }
  ```

### `GET /api/fichas-tecnicas/produto/:produtoId`
Lista as fichas técnicas (ingredientes) de um produto específico.

- **Método**: `GET`
- **Caminho**: `/api/fichas-tecnicas/produto/:produtoId`

### `DELETE /api/fichas-tecnicas/:id`
Remove um insumo da ficha técnica de um produto.

---

## 5. Vendas & Integrações (`/api/webhook`, `/api/vendas`)

### `POST /api/webhook/anota-ai`
Recebe do Anota AI os eventos de pedido e salva o payload bruto no banco para a consolidação de estoque. **O webhook avisa mudanças de estado de um mesmo pedido** (aceito, atualizado, cancelado), todas com o mesmo ID; por isso o último estado do pedido é o que vale.

- **Método**: `POST`
- **Caminho**: `/api/webhook/anota-ai`
- **Headers**: `Content-Type: application/json`, `x-webhook-secret: <ANOTAAI_WEBHOOK_SECRET>` (alternativa: query `?token=`), opcional `x-webhook-id` / `x-event-id` / `x-idempotency-key`
- **Body**: JSON dinâmico (payload do Anota AI). O ID do pedido é lido dos headers acima ou dos campos `id`, `_id`, `orderId`, `externalId` (raiz, `order.*`, `pedido.*`, `data.*` ou `info.*`) e salvo em `Venda.externalId` (único).
- **Resposta de Sucesso (200 OK)**, conforme o caso:
  - Pedido novo: `{ "received": true }`
  - Reenvio idêntico: `{ "received": true, "duplicate": true }` (nada muda)
  - Novo estado de um pedido **ainda não consolidado** (ex.: aceito para cancelado, ou quantidade alterada): `{ "received": true, "duplicate": true, "updated": true }`. O payload é substituído pelo mais recente.
  - Evento diferente para um pedido **já consolidado**: `{ "received": true, "duplicate": true }`. O estoque já foi abatido e a venda não é reescrita (ver decisão pendente em `docs/requests.md`).
  - Sem ID de pedido no payload não há como deduplicar: cada evento vira uma venda (fica um aviso no log).
- **O 200 só é devolvido após gravar.**
- **Erros**: `401` segredo inválido/ausente; `503` `ANOTAAI_WEBHOOK_SECRET` não configurado; `500` falha ao gravar (a Anota AI deve reenviar).

### `POST /api/vendas/consolidar`
Reivindica todas as vendas com `processado = false` e abate o estoque dos insumos pela Ficha Técnica de cada item vendido (com fator de perda). Tudo ocorre em uma única transação: as vendas são marcadas como processadas **antes** do abatimento, então duas execuções simultâneas não descontam o estoque em dobro (a segunda retorna `consolidadas: 0`). O estado do pedido (`check`) define o destino de cada venda: **1, 2 e 3** (aceito, pronto, finalizado) abatem o estoque; **4, 5, -4, 41 e 42** (cancelado, negado, rejeitado, expirado) são marcados como processados **sem abater**; **0, -2, -1, -3, 6** e valores desconhecidos (ainda não aceito, agendado, aguardando pagamento ou pedido de cancelamento) **continuam pendentes** para a próxima execução. Payload sem `check` é abatido como antes. Venda com payload malformado não interrompe o lote: ela é marcada como processada, sem abater estoque, e contada em `vendasSemItens`. Se o estoque ficar negativo (a venda já aconteceu), o abatimento é feito e o insumo é sinalizado na resposta. Formatos de payload aceitos: `items`, `order.items` ou array na raiz, com `name/quantity/price` ou `nome/quantidade/preco` (mesmo parser do dashboard).

- **Método**: `POST`
- **Caminho**: `/api/vendas/consolidar`
- **Headers**: `x-cron-secret: <CRON_SECRET>` (não usa JWT)
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "consolidadas": 15,
    "insumosAfetados": 8,
    "vendasSemItens": 1,
    "canceladasIgnoradas": 2,
    "vendasAguardando": 1,
    "produtosNaoEncontrados": ["Lanche Fantasma"],
    "insumosComEstoqueNegativo": [
      { "id": "uuid", "nome": "Carne de Hambúrguer", "estoqueAtual": -60 }
    ]
  }
  ```
  Sem vendas pendentes: `{ "consolidadas": 0, "mensagem": "Nenhuma venda pendente de processamento." }`.
- **Erros**:
  - `401 Unauthorized`: segredo do cron inválido ou ausente.
  - `503 Service Unavailable`: `CRON_SECRET` não configurado no servidor.
  - `500 Internal Server Error`: falha na transação de banco de dados.
- O workflow `.github/workflows/cron.yml` dispara o aquecimento (`GET /health`, 17:50 BRT) e a consolidação (23:15 BRT), de quarta a domingo.

---

## 6. Perdas (`/api/perdas`)

Motivos válidos (`MotivoPerda`): `VENCIMENTO`, `ERRO_PREPARO`, `ESTRAGADO`, `OUTRO`.

### `POST /api/perdas`
Registra uma perda e abate `quantidade` do `estoqueAtual` do insumo, de forma atômica (transação).

- **Body**:
  ```json
  { "insumoId": "uuid", "quantidade": 200, "motivo": "ESTRAGADO" }
  ```
  - `insumoId` (*uuid*, obrigatório), `quantidade` (*number* > 0, obrigatório), `motivo` (*enum*, obrigatório).
- **Resposta (201 Created)**: a perda criada, com `insumo` incluído (`id`, `insumoId`, `quantidade`, `motivo`, `criadoEm`, `insumo`).
- **Erros**: `400` (validação Zod: `{ message, issues }`), `404` (`{ "message": "Insumo não encontrado" }`), `500`.

### `GET /api/perdas`
Lista perdas mais recentes primeiro, com `insumo` incluído.

- **Query**: `limite` (*int*, 1–200, default 50).
- **Resposta (200 OK)**: array de perdas.

### `GET /api/perdas/resumo-mensal`
Soma de perdas por motivo no mês (base para o relatório da Fase 6). Motivos sem registros não aparecem.

- **Query**: `ano` (default: ano atual), `mes` (1–12, default: mês atual).
- **Resposta (200 OK)**:
  ```json
  {
    "ano": 2026,
    "mes": 10,
    "porMotivo": [
      { "motivo": "ESTRAGADO", "quantidadeTotal": 500, "ocorrencias": 3 }
    ]
  }
  ```
  > Valor monetário ainda não é calculado: `Insumo` não possui custo unitário. Ver `docs/requests.md`.

---

## 7. Preparo Interno (`/api/preparo-interno`)

Itens beneficiados são `Insumo` com `produzidoInternamente = true` (e `validadeDias` opcional). `POST/PUT /api/insumos` agora aceitam também `produzidoInternamente` (*boolean*) e `validadeDias` (*int*, opcional).

A sub-ficha define, por **1 unidade** do beneficiado (ex.: 1 g de maionese), quanto de cada insumo bruto é necessário (`quantidadeNecessaria`). Produzir `X` consome `quantidadeNecessaria × (1 + fatorPerda do bruto) × X`.

### `POST /api/preparo-interno/sub-fichas`
Vincula um insumo bruto à sub-ficha de um beneficiado.

- **Body**: `{ "insumoBeneficiadoId": "uuid", "insumoBrutoId": "uuid", "quantidadeNecessaria": 0.64 }`
- **Resposta (201)**: registro criado com `insumoBruto`.
- **Erros**: `400` (validação), `500` (ex.: par já vinculado — único por beneficiado/bruto).

### `GET /api/preparo-interno/sub-fichas/:insumoBeneficiadoId`
Lista os ingredientes da sub-ficha (com `insumoBruto`).

### `DELETE /api/preparo-interno/sub-fichas/:id`
Remove um ingrediente da sub-ficha. Resposta `204`.

### `POST /api/preparo-interno/produzir`
Produz uma quantidade do beneficiado: abate os brutos e soma ao estoque do beneficiado, atomicamente.

- **Body**: `{ "insumoBeneficiadoId": "uuid", "quantidade": 1500 }`
- **Resposta (200 OK)**:
  ```json
  {
    "insumo": { "id": "uuid", "nome": "Maionese da Casa - Beneficiado", "estoqueAtual": 3000 },
    "quantidadeProduzida": 1500,
    "validadeEm": "2026-10-20T16:00:00.000Z",
    "consumos": [ { "insumoBrutoId": "uuid", "nome": "Óleo de soja", "consumo": 967 } ]
  }
  ```
  `validadeEm` é `null` se o beneficiado não tem `validadeDias`.
- **Erros**: `400` (validação, insumo não é beneficiado ou sem sub-ficha), `404` (insumo não encontrado), `409` (estoque insuficiente de bruto: `{ message }`), `500`.

---

## 8. Notas Fiscais (`/api/notas-fiscais`)

Processamento de notas fiscais eletrônicas (NF-e) para conferência e entrada no almoxarifado.

### `POST /api/notas-fiscais/parser-xml`
Recebe o conteúdo em texto do arquivo XML da NF-e, processa os dados fiscais, extrai itens e sugere o casamento com os insumos existentes no almoxarifado junto com o fator de conversão de unidade (ex.: KG para Gramas).

- **Método**: `POST`
- **Caminho**: `/api/notas-fiscais/parser-xml`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "xml": "<?xml version=\"1.0\"...<nfeProc>...</nfeProc>"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "chaveAcesso": "35261012345678000199550010000012341234567890",
    "numero": "1234",
    "serie": "1",
    "dataEmissao": "2026-10-10T14:30:00-04:00",
    "fornecedor": {
      "nome": "DISTRIBUIDORA DE ALIMENTOS MS LTDA",
      "cnpjCpf": "12345678000199"
    },
    "valorTotal": 550.00,
    "itens": [
      {
        "itemNumero": 1,
        "codigo": "BAC01",
        "descricao": "BACON FATIADO EXTRA",
        "ncm": "02091000",
        "unidadeOriginal": "KG",
        "quantidadeOriginal": 10,
        "valorUnitario": 32.50,
        "valorTotal": 325.00,
        "sugestaoInsumoId": "uuid-do-insumo",
        "sugestaoInsumoNome": "Bacon fatiado",
        "sugestaoUnidadeInsumo": "Gramas",
        "fatorConversaoSugerido": 1000,
        "quantidadeConvertidaSugerida": 10000
      }
    ]
  }
  ```
- **Erros**:
  - `400 Bad Request`: XML inválido, vazio, acima de 500 KB (`512.000` caracteres) ou sem estrutura de NF-e válida.

### `POST /api/notas-fiscais/parser-qrcode`
Recebe uma URL de QR Code de NFC-e (ou a chave de 44 dígitos digitada manualmente). Extrai a chave de acesso, consulta a página pública da SEFAZ, realiza o scraping dos itens faturados e executa o algoritmo de identificação inteligente de insumos. Se a SEFAZ estiver bloqueada ou indisponível, retorna um fallback gracioso com a chave de 44 dígitos preenchida para digitação manual ou upload do XML.

- **Método**: `POST`
- **Caminho**: `/api/notas-fiscais/parser-qrcode`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "urlOuChave": "http://www.dfe.ms.gov.br/nfce/qrcode?p=50261012345678000199650010000012341234567890|2|1|1|ABCD"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "chaveAcesso": "50261012345678000199650010000012341234567890",
    "sucessoScraping": true,
    "fornecedor": {
      "nome": "SUPERMERCADO ATACADAO LTDA",
      "cnpjCpf": "12345678000199"
    },
    "valorTotal": 154.00,
    "dataEmissao": "2026-10-07T22:32:11.000Z",
    "dataEmissaoAproximada": false,
    "itens": [
      {
        "itemNumero": 1,
        "codigo": "1001",
        "descricao": "QUEIJO CHEDDAR FATIADO",
        "unidadeOriginal": "KG",
        "quantidadeOriginal": 2.5,
        "valorUnitario": 40.0,
        "valorTotal": 100.0,
        "sugestaoInsumoId": "uuid-do-insumo",
        "sugestaoInsumoNome": "Queijo Cheddar",
        "sugestaoUnidadeInsumo": "Gramas",
        "fatorConversaoSugerido": 1000,
        "quantidadeConvertidaSugerida": 2500,
        "confiancaMatch": 95,
        "motivoMatch": "SIMILARIDADE"
      }
    ]
  }
  ```
- **Erros**:
  - `400 Bad Request`: Não foi possível extrair uma chave válida de 44 dígitos da URL ou texto fornecido, ou a URL não é permitida (ver abaixo).
- **Segurança (SSRF)**: o servidor só consulta URLs de portais `*.gov.br` (configurável em `QRCODE_HOSTS_PERMITIDOS`, lista de sufixos separada por vírgula). `http://` é convertido para `https://`; hosts que resolvem para IP interno/privado, credenciais na URL, portas diferentes de 443 e mais de 2 redirecionamentos são rejeitados. Resposta limitada a 2 MB e 8 s.
- **Data de emissão**: lida da página da SEFAZ. Se indisponível (inclui o fallback sem scraping), usa o ano/mês da chave de acesso (dia 1) e devolve `dataEmissaoAproximada: true`.

### `GET /api/notas-fiscais`
Retorna a listagem das notas fiscais importadas no sistema, ordenadas da mais recente para a mais antiga, incluindo seus itens faturados e insumos vinculados.

- **Método**: `GET`
- **Caminho**: `/api/notas-fiscais`
- **Headers**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  [
    {
      "id": "uuid",
      "chaveAcesso": "35261012345678000199550010000012341234567890",
      "numero": "1234",
      "serie": "1",
      "fornecedorNome": "DISTRIBUIDORA DE ALIMENTOS MS LTDA",
      "fornecedorCnpj": "12345678000199",
      "valorTotal": 550.00,
      "dataEmissao": "2026-10-10T14:30:00.000Z",
      "criadoEm": "2026-10-14T08:00:00.000Z",
      "itens": [
        {
          "id": "uuid",
          "insumoId": "uuid-do-insumo",
          "descricaoOriginal": "BACON FATIADO EXTRA",
          "unidadeOriginal": "KG",
          "quantidadeOriginal": 10,
          "valorUnitario": 32.50,
          "valorTotal": 325.00,
          "quantidadeConvertida": 10000,
          "insumo": {
            "id": "uuid-do-insumo",
            "nome": "Bacon fatiado",
            "unidade": "Gramas"
          }
        }
      ]
    }
  ]
  ```

### `POST /api/notas-fiscais/confirmar`
Confirma a entrada dos itens mapeados no almoxarifado:
1. Incrementa atomicamente (`$transaction`) o `estoqueAtual` de cada insumo.
2. Atualiza o `custoUnitario` do insumo com o valor unitário da compra.
3. Persiste a `NotaFiscal` e seus `ItemNotaFiscal` vinculados no banco de dados.
4. Previne duplicidade através da chave de acesso única de 44 dígitos. A nota é sempre registrada quando há `chaveAcesso`, mesmo sem fornecedor/CNPJ identificados (nome `Fornecedor não identificado` e CNPJ vazio), para que a reimportação seja barrada.

- **Método**: `POST`
- **Caminho**: `/api/notas-fiscais/confirmar`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "chaveAcesso": "35261012345678000199550010000012341234567890",
    "numero": "1234",
    "serie": "1",
    "fornecedorNome": "DISTRIBUIDORA DE ALIMENTOS MS LTDA",
    "fornecedorCnpj": "12345678000199",
    "valorTotal": 325.00,
    "dataEmissao": "2026-10-10T14:30:00-04:00",
    "itens": [
      {
        "insumoId": "uuid-do-insumo",
        "quantidade": 10000,
        "valorUnitario": 0.0325,
        "descricaoOriginal": "BACON FATIADO EXTRA",
        "unidadeOriginal": "KG",
        "quantidadeOriginal": 10,
        "valorTotal": 325.00
      }
    ]
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "notaFiscalId": "uuid-da-nota-criada",
    "chaveAcesso": "35261012345678000199550010000012341234567890",
    "fornecedorNome": "DISTRIBUIDORA DE ALIMENTOS MS LTDA",
    "totalItensProcessados": 1,
    "insumosAtualizados": [
      {
        "id": "uuid-do-insumo",
        "nome": "Bacon fatiado",
        "novoEstoque": 15000,
        "adicionado": 10000,
        "custoUnitario": 0.0325
      }
    ]
  }
  ```
- **Erros**:
  - `400 Bad Request`: Dados inválidos ou nenhum item selecionado.
  - `409 Conflict`: nota fiscal com essa `chaveAcesso` já foi importada (inclusive em importações simultâneas). Nada é alterado no estoque.

---

## 9. Dashboard Executivo e Relatórios

### `GET /api/dashboard/resumo`
Pedidos cancelados/negados (`check` 4, 5, -4, 41 e 42) não entram em faturamento, itens mais vendidos nem consumo. Retorna os indicadores consolidados do negócio (KPIs executivos, perdas por motivo com valor monetário, itens mais vendidos, consumo de insumos pelas fichas técnicas, compras por fornecedor e alertas de estoque).

- **Método**: `GET`
- **Caminho**: `/api/dashboard/resumo`
- **Query Params**:
  - `periodo`: `'hoje'` | `'semana'` | `'mes'` (default: `'mes'`)
  - `dataInicio`: data ISO de início (opcional para filtro personalizado; exige `dataFim`, `dataInicio <= dataFim` e intervalo máximo de `366` dias — caso contrário retorna `400 Bad Request`)
  - `dataFim`: data ISO de fim (opcional para filtro personalizado)
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "periodo": {
      "tipo": "mes",
      "dataInicio": "2026-10-01T00:00:00.000Z",
      "dataFim": "2026-10-14T23:59:59.999Z"
    },
    "kpis": {
      "totalVendasValor": 12450.00,
      "totalVendasQtd": 312,
      "totalComprasValor": 4200.00,
      "totalComprasQtd": 8,
      "totalPerdasValor": 185.50,
      "totalPerdasQtd": 14,
      "insumosEmAlertaQtd": 3
    },
    "perdasPorMotivo": [
      {
        "motivo": "VENCIMENTO",
        "label": "Vencimento",
        "valorTotal": 98.00,
        "quantidadeTotal": 4.5,
        "totalOcorrencias": 5,
        "percentual": 52.8
      },
      {
        "motivo": "ERRO_PREPARO",
        "label": "Erro de Preparo",
        "valorTotal": 52.50,
        "quantidadeTotal": 3.0,
        "totalOcorrencias": 6,
        "percentual": 28.3
      }
    ],
    "consumoInsumos": [
      {
        "insumoId": "uuid-insumo",
        "nome": "Carne de Hambúrguer",
        "unidade": "Gramas",
        "quantidadeConsumida": 48000,
        "valorEstimado": 2400.00
      }
    ],
    "itensMaisVendidos": [
      {
        "produtoNome": "BACON HOUSE",
        "quantidadeVendida": 142,
        "valorEstimadoTotal": 4970.00
      }
    ],
    "estoqueAlerta": [
      {
        "id": "uuid-insumo",
        "nome": "Pão Brioche",
        "unidade": "Unidade",
        "estoqueAtual": 15,
        "estoqueMinimo": 50,
        "status": "CRITICO",
        "percentualEstoque": 30.0
      }
    ],
    "comprasPorFornecedor": [
      {
        "fornecedorNome": "DISTRIBUIDORA DE ALIMENTOS MS LTDA",
        "fornecedorCnpj": "12345678000199",
        "valorTotal": 2800.00,
        "totalNotas": 4,
        "percentual": 66.7
      }
    ]
  }
  ```

---

## 10. Autenticação e Usuários (`/api/auth`)

Módulo de autenticação com JWT e gerenciamento de perfil e credenciais de acesso.

### `POST /api/auth/login`
Autentica o usuário com e-mail e senha, retornando um Bearer Token JWT e os dados do usuário.

- **Método**: `POST`
- **Caminho**: `/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "email": "gerente@burguerhouse.com.br",
    "senha": "admin123"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "usuario": {
      "id": "uuid-do-usuario",
      "nome": "Carlos Eduardo",
      "email": "gerente@burguerhouse.com.br",
      "telefone": "(67) 99876-5432",
      "role": "ADMIN",
      "ativo": true,
      "criadoEm": "2026-10-14T12:00:00.000Z",
      "atualizadoEm": "2026-10-14T12:00:00.000Z"
    }
  }
  ```
- **Token JWT**:
  - Assinado com claims `{ sub, email, role, tv }`, com validade de 12 horas.
  - Se o usuário trocar a senha ou for desativado, o token anterior é revogado imediatamente e qualquer requisição recebe `401 Unauthorized` (`Token revogado. Faça login novamente.` ou `Usuário não encontrado ou inativo`).
- **Erros**:
  - `400 Bad Request`: Validação Zod incorreta.
  - `401 Unauthorized`: E-mail não encontrado, usuário inativo ou senha inválida.
  - `429 Too Many Requests`: mais de 10 tentativas por IP em 15 minutos (header `Retry-After` em segundos). Atrás de proxy, defina `TRUST_PROXY=<número de proxies à frente da API>` (ex.: `1`) para usar o IP real do cliente; `true` também funciona, mas confia em todo o `X-Forwarded-For` e permite forjar o IP.

### `GET /api/auth/me`
Retorna as informações do usuário autenticado a partir do token JWT.

- **Método**: `GET`
- **Caminho**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "usuario": {
      "id": "uuid-do-usuario",
      "nome": "Carlos Eduardo",
      "email": "gerente@burguerhouse.com.br",
      "telefone": "(67) 99876-5432",
      "role": "ADMIN",
      "ativo": true
    }
  }
  ```
- **Erros**:
  - `401 Unauthorized`: Token ausente ou inválido.
  - `404 Not Found`: Usuário não encontrado ou inativo.

### `PUT /api/auth/perfil`
Atualiza dados cadastrais do próprio usuário autenticado (nome e telefone).

- **Método**: `PUT`
- **Caminho**: `/api/auth/perfil`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "nome": "Carlos Eduardo Pereira",
    "telefone": "(67) 99999-8888"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "usuario": {
      "id": "uuid-do-usuario",
      "nome": "Carlos Eduardo Pereira",
      "email": "gerente@burguerhouse.com.br",
      "telefone": "(67) 99999-8888",
      "role": "ADMIN",
      "ativo": true
    }
  }
  ```
- **Erros**:
  - `400 Bad Request`: Erro de validação (`nome` entre 2 e 100 caracteres após o trim; `telefone` até 30 caracteres; telefone só com espaços vira `null`).
  - `401 Unauthorized`: Token ausente ou inválido.
  - `404 Not Found`: Usuário não encontrado ou inativo (inclui o caso de o usuário ser removido durante a requisição).

### `PUT /api/auth/senha`
Altera a senha de acesso do usuário autenticado mediante confirmação da senha atual.

- **Método**: `PUT`
- **Caminho**: `/api/auth/senha`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "senhaAtual": "admin123",
    "novaSenha": "novaSenhaSegura456"
  }
  ```
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "message": "Senha atualizada com sucesso",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Erros**:
  - `400 Bad Request`: Senha atual incorreta, nova senha com menos de 6 caracteres ou com mais de 72 bytes (limite do bcrypt).
  - `401 Unauthorized`: Token ausente ou inválido.
  - `409 Conflict`: a senha foi alterada em outra sessão durante a requisição (duas trocas simultâneas); tente novamente.
  - `429 Too Many Requests`: mais de 5 tentativas por usuário em 15 minutos (header `Retry-After` em segundos).

### `POST /api/auth/logout`
Encerra a sessão do usuário autenticado no servidor, incrementando o `tokenVersion` no banco e revogando imediatamente todos os tokens JWT ativos.

- **Método**: `POST`
- **Caminho**: `/api/auth/logout`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "message": "Logout realizado com sucesso"
  }
  ```
- **Erros**:
  - `401 Unauthorized`: Token ausente ou inválido.


