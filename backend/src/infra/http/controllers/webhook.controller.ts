import type { FastifyRequest, FastifyReply } from 'fastify';
import { VendasRepository } from '../../../modules/vendas/repositories/vendas.repository.js';

const vendasRepository = new VendasRepository();

export class WebhookController {
  async receberAnotaAi(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.body;

    // Responde 200 OK imediatamente (fire-and-forget)
    reply.status(200).send({ received: true });

    // Processa a escrita no banco de forma assíncrona
    try {
      await vendasRepository.salvar({
        payloadOriginal: payload
      });
      console.log('Webhook salvo com sucesso na tabela de Vendas.');
    } catch (error) {
      console.error('Falha crítica ao gravar webhook no banco:', error);
      // Aqui em produção poderia jogar para uma DLQ ou Sentry
    }
  }
}
