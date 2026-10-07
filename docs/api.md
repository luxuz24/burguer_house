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
