import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { VendasRetidasService } from '../../../modules/vendas/services/vendas_retidas.service.js';

const listarRetidasQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export class VendasRetidasController {
  async listar(request: FastifyRequest, reply: FastifyReply) {
    const query = listarRetidasQuerySchema.parse(request.query ?? {});
    const resultado = await new VendasRetidasService().listar(query);
    return reply.status(200).send(resultado);
  }
}
