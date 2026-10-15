import type { FastifyRequest, FastifyReply } from 'fastify';
import { ConsolidacaoService } from '../../../modules/vendas/services/consolidacao.service.js';
import { segredoValido } from '../segredo.js';

const consolidacaoService = new ConsolidacaoService();

export class ConsolidacaoController {
  async executar(request: FastifyRequest, reply: FastifyReply) {
    // Chamada pelo cron externo: autenticada por segredo de serviço, não por JWT de usuário.
    const esperado = process.env.CRON_SECRET;
    if (!esperado) {
      request.log.error('CRON_SECRET não configurado; consolidação desabilitada.');
      return reply.status(503).send({ message: 'Consolidação não configurada' });
    }
    if (!segredoValido(request.headers['x-cron-secret'], esperado)) {
      return reply.status(401).send({ message: 'Segredo do cron inválido' });
    }

    try {
      const resultado = await consolidacaoService.consolidarVendasDoDia();
      return reply.status(200).send(resultado);
    } catch (error) {
      request.log.error({ err: error }, 'Erro na consolidação de vendas');
      return reply.status(500).send({ message: 'Erro ao consolidar vendas' });
    }
  }
}
