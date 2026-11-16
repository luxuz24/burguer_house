import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ListarFechamentosManuaisService,
  ListarFechamentosError,
} from '../../../modules/vendas/services/listar_fechamentos_manuais.service.js';

const querySchema = z.object({
  data: z.string().optional(),
});

export class ListarFechamentosManuaisController {
  async listar(request: FastifyRequest, reply: FastifyReply) {
    const { data } = querySchema.parse(request.query);

    try {
      const resultado = await new ListarFechamentosManuaisService().listar({ data });
      return reply.status(200).send(resultado);
    } catch (error) {
      if (error instanceof ListarFechamentosError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }
}
