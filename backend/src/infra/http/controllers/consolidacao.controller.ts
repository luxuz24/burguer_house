import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConsolidacaoService } from '../../../modules/vendas/services/consolidacao.service.js';

const consolidacaoService = new ConsolidacaoService();

export class ConsolidacaoController {
  async executar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const resultado = await consolidacaoService.consolidarVendasDoDia();
      reply.status(200).send(resultado);
    } catch (error: any) {
      console.error('Erro na consolidação de vendas:', error);
      reply.status(500).send({ error: 'Erro ao consolidar vendas', details: error.message });
    }
  }
}
