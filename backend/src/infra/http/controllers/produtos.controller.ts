import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProdutosRepository } from '../../../modules/produtos/repositories/produtos.repository.js';

export class ProdutosController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new ProdutosRepository();
    const data = request.body as { nome: string }; 
    
    try {
      const produto = await repo.criar(data);
      return reply.status(201).send(produto);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao cadastrar produto' });
    }
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new ProdutosRepository();
    const produtos = await repo.listarTodos();
    return reply.send(produtos);
  }

  async buscarPorId(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new ProdutosRepository();
    const { id } = request.params;
    
    try {
      const produto = await repo.buscarPorId(id);
      if (!produto) {
        return reply.status(404).send({ message: 'Produto não encontrado' });
      }
      return reply.send(produto);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao buscar o produto' });
    }
  }

  async atualizar(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new ProdutosRepository();
    const { id } = request.params;
    const data = request.body as { nome: string };

    try {
      const produtoAtualizado = await repo.atualizar(id, data);
      return reply.send(produtoAtualizado);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao atualizar o produto' });
    }
  }

  async deletar(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new ProdutosRepository();
    const { id } = request.params;

    try {
      await repo.deletar(id);
      return reply.status(204).send(); 
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao deletar o produto' });
    }
  }
}
