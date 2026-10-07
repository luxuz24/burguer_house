import type { FastifyRequest, FastifyReply } from 'fastify';
import { InsumosRepository } from '../../../modules/insumos/repositories/insumos.repository.js';

export class InsumosController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const data = request.body as any; 
    
    try {
      const insumo = await repo.criar(data);
      return reply.status(201).send(insumo);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao cadastrar insumo' });
    }
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const insumos = await repo.listarTodos();
    return reply.send(insumos);
  }

  async alertas(request: FastifyRequest, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const alertas = await repo.listarAlertas();
    return reply.send(alertas);
  }

  async atualizar(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const { id } = request.params;
    const data = request.body as any;

    try {
      const insumoAtualizado = await repo.atualizar(id, data);
      return reply.send(insumoAtualizado);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao atualizar o insumo' });
    }
  }

  async deletar(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const { id } = request.params;

    try {
      await repo.deletar(id);
      return reply.status(204).send(); 
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao deletar o insumo' });
    }
  }

}