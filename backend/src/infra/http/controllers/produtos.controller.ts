import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ProdutosRepository,
  ConflitoNomeProdutoError,
} from '../../../modules/produtos/repositories/produtos.repository.js';

const idParamSchema = z.object({ id: z.string().uuid('ID de produto inválido') });
const produtoSchema = z.object({ nome: z.string().trim().min(1, 'O nome é obrigatório') });

export class ProdutosController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const data = produtoSchema.parse(request.body);
    try {
      const produto = await new ProdutosRepository().criar(data);
      return reply.status(201).send(produto);
    } catch (err) {
      if (err instanceof ConflitoNomeProdutoError) {
        return reply.status(409).send({ message: err.message, produtoConflito: err.produtoConflito });
      }
      throw err;
    }
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await new ProdutosRepository().listarTodos());
  }

  async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const produto = await new ProdutosRepository().buscarPorId(id);
    if (!produto) {
      return reply.status(404).send({ message: 'Produto não encontrado' });
    }
    return reply.send(produto);
  }

  async atualizar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const data = produtoSchema.parse(request.body);
    try {
      const produto = await new ProdutosRepository().atualizar(id, data);
      return reply.send(produto);
    } catch (err) {
      if (err instanceof ConflitoNomeProdutoError) {
        return reply.status(409).send({ message: err.message, produtoConflito: err.produtoConflito });
      }
      throw err;
    }
  }

  async deletar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await new ProdutosRepository().deletar(id);
    return reply.status(204).send();
  }
}
