import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { DashboardService, PeriodoInvalidoError } from '../../../modules/dashboard/services/dashboard.service.js';

const resumoQuerySchema = z.object({
  periodo: z.enum(['hoje', 'semana', 'mes']).optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
});

export class DashboardController {
  private service: DashboardService;

  constructor() {
    this.service = new DashboardService();
  }

  async obterResumo(request: FastifyRequest, reply: FastifyReply) {
    const parsed = resumoQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Parâmetros de consulta do dashboard inválidos',
        issues: parsed.error.issues,
      });
    }

    try {
      const resumo = await this.service.obterResumo(parsed.data);
      return reply.send(resumo);
    } catch (error: any) {
      if (error instanceof PeriodoInvalidoError) {
        return reply.status(400).send({ message: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({
        message: 'Erro ao consolidar dados do dashboard',
      });
    }
  }
}
