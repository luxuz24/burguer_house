import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { MarcarVendasTratadasService } from '../../../modules/vendas/services/marcar_vendas_tratadas.service.js';
import { parsearDiaLoja } from '../../../shared/datas.js';

const marcarTratadasBodySchema = z.object({
  ate: z
    .string()
    .trim()
    .refine((valor) => parsearDiaLoja(valor, 'fim') !== null, {
      message: 'Data inválida; use o formato AAAA-MM-DD',
    }),
  motivo: z.string().trim().min(1, 'Motivo é obrigatório').max(500),
});

export class MarcarVendasTratadasController {
  async executar(request: FastifyRequest, reply: FastifyReply) {
    const body = marcarTratadasBodySchema.parse(request.body ?? {});
    const resultado = await new MarcarVendasTratadasService().executar(body);
    return reply.status(200).send(resultado);
  }
}
