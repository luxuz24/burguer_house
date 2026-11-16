import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  SaidaDiaService,
  SaidaDiaError,
} from '../../../modules/estoque/services/saida_dia.service.js';

const querySchema = z.object({
  data: z.string().optional(),
});

export class SaidaDiaController {
  async obter(request: FastifyRequest, reply: FastifyReply) {
    const { data } = querySchema.parse(request.query ?? {});

    try {
      const resultado = await new SaidaDiaService().obter({ data });
      return reply.send(resultado);
    } catch (error) {
      if (error instanceof SaidaDiaError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }
}
