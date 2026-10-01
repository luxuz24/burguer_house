import type { FastifyRequest, FastifyReply } from 'fastify';
import { InsumosRepository } from '../../../modules/insumos/repositories/insumos.repository.js';

export class InsumosController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const repo = new InsumosRepository();
    const data = request.body as any; // Futuramente validaremos com Zod
    
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
}