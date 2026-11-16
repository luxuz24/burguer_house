import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  EstornarFechamentoService,
  EstornoFechamentoError,
} from '../../../modules/vendas/services/estornar_fechamento.service.js';

const paramsSchema = z.object({
  id: z.string().uuid('ID de venda inválido'),
});

const bodySchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, 'Informe o motivo do estorno')
    .max(500, 'O motivo deve ter no máximo 500 caracteres'),
});

export class EstornarFechamentoController {
  async estornar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = paramsSchema.parse(request.params);
    const { motivo } = bodySchema.parse(request.body);
    const usuarioId = request.user?.sub ?? null;

    try {
      const resultado = await new EstornarFechamentoService().executar({
        vendaId: id,
        motivo,
        usuarioId,
      });
      return reply.status(200).send(resultado);
    } catch (error) {
      if (error instanceof EstornoFechamentoError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }
}
