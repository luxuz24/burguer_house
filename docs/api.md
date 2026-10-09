# Documentação da API - Burguer House

Esta documentação descreve todas as rotas HTTP atualmente implementadas no backend Fastify, baseada na leitura do código real das rotas, controllers e repositórios.

A API roda por padrão na porta `3000` (`http://localhost:3000`). Todas as rotas de domínio utilizam o prefixo `/api`.

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
Recebe o payload bruto de uma nova venda do sistema Anota AI e salva no banco de dados para processamento posterior (Assíncrono).

- **Método**: `POST`
- **Caminho**: `/api/webhook/anota-ai`
- **Headers**: `Content-Type: application/json`
- **Body**: JSON dinâmico (Payload do Anota AI)
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "received": true
  }
  ```
  *(A requisição é encerrada com sucesso imediatamente para evitar timeouts no sistema parceiro. A gravação ocorre em background).*

### `POST /api/vendas/consolidar`
Varre todas as vendas registradas com o status `processado = false`. Para cada venda, abate a quantidade do insumo baseando-se na Ficha Técnica de cada item vendido. Após o processamento, as vendas são marcadas como `processado = true`. Essa rota deve ser engatilhada por um cron job noturno.

- **Método**: `POST`
- **Caminho**: `/api/vendas/consolidar`
- **Headers**: Nenhum
- **Body**: Nenhum
- **Resposta de Sucesso (200 OK)**:
  ```json
  {
    "consolidadas": 15,
    "insumosAfetados": 8
  }
  ```
- **Erros**:
  - `500 Internal Server Error`: Caso a transação de banco de dados falhe.
