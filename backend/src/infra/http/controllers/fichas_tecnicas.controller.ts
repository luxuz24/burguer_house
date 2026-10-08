import type { FastifyRequest, FastifyReply } from 'fastify';
import { FichasTecnicasRepository } from '../../../modules/fichas_tecnicas/repositories/fichas_tecnicas.repository.js';

export class FichasTecnicasController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new FichasTecnicasRepository();
    const data = request.body as { produtoId: string; insumoId: string; quantidade: number }; 
    
    try {
      const ficha = await repo.criar(data);
      return reply.status(201).send(ficha);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao criar ficha técnica' });
    }
  }

  async listarPorProduto(request: FastifyRequest<{ Params: { produtoId: string } }>, reply: FastifyReply) {
    const repo = new FichasTecnicasRepository();
    const { produtoId } = request.params;
    
    try {
      const fichas = await repo.listarPorProduto(produtoId);
      return reply.send(fichas);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao listar fichas técnicas' });
    }
  }

  async deletar(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new FichasTecnicasRepository();
    const { id } = request.params;

    try {
      await repo.deletar(id);
      return reply.status(204).send(); 
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao deletar ficha técnica' });
    }
  }
}
