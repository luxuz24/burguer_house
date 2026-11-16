import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  FechamentoManualService,
  FechamentoManualError,
} from '../../../modules/vendas/services/fechamento_manual.service.js';

const itemFechamentoSchema = z.object({
  produtoId: z.string().uuid('ID de produto inválido'),
  quantidade: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade deve ser no mínimo 1')
    .max(500, 'A quantidade máxima por item é 500'),
});

const simulacaoSchema = z.object({
  data: z.string().trim().optional(),
  itens: z
    .array(itemFechamentoSchema)
    .min(1, 'Informe ao menos um produto')
    .max(100, 'Máximo de 100 itens por fechamento'),
});

const confirmarFechamentoSchema = z.object({
  chaveIdempotencia: z
    .string()
    .trim()
    .min(8, 'A chave de idempotência deve ter no mínimo 8 caracteres')
    .max(100, 'A chave de idempotência deve ter no máximo 100 caracteres'),
  data: z.string().trim().optional(),
  observacao: z
    .string()
    .trim()
    .max(500, 'A observação deve ter no máximo 500 caracteres')
    .optional(),
  itens: z
    .array(itemFechamentoSchema)
    .min(1, 'Informe ao menos um produto')
    .max(100, 'Máximo de 100 itens por fechamento'),
});

export class FechamentoManualController {
  async simular(request: FastifyRequest, reply: FastifyReply) {
    const parsed = simulacaoSchema.parse(request.body);
    try {
      const resultado = await new FechamentoManualService().simular(parsed);
      return reply.send(resultado);
    } catch (error) {
      if (error instanceof FechamentoManualError) {
        return reply.status(error.status).send({
          message: error.message,
          ...(error.detalhes ? error.detalhes : {}),
        });
      }
      throw error;
    }
  }

  async confirmar(request: FastifyRequest, reply: FastifyReply) {
    const parsed = confirmarFechamentoSchema.parse(request.body);
    const usuarioId = request.user?.sub ?? null;

    try {
      const resultado = await new FechamentoManualService().confirmar({
        ...parsed,
        usuarioId,
      });
      return reply.status(resultado.reaproveitado ? 200 : 201).send(resultado);
    } catch (error) {
      if (error instanceof FechamentoManualError) {
        return reply.status(error.status).send({
          message: error.message,
          ...(error.detalhes ? error.detalhes : {}),
        });
      }
      throw error;
    }
  }
}
