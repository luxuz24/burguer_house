import type { FastifyRequest, FastifyReply } from 'fastify';
import { VendasRepository } from '../../../modules/vendas/repositories/vendas.repository.js';
import { segredoValido } from '../segredo.js';

const vendasRepository = new VendasRepository();

export class WebhookController {
  async receberAnotaAi(request: FastifyRequest, reply: FastifyReply) {
    const esperado = process.env.ANOTAAI_WEBHOOK_SECRET;
    if (!esperado) {
      request.log.error('ANOTAAI_WEBHOOK_SECRET não configurado; webhook desabilitado.');
      return reply.status(503).send({ message: 'Webhook não configurado' });
    }

    // Segredo via header (preferido) ou query string ?token=
    const recebido =
      request.headers['x-webhook-secret'] ?? (request.query as Record<string, unknown> | undefined)?.token;
    if (!segredoValido(recebido, esperado)) {
      return reply.status(401).send({ message: 'Segredo do webhook inválido' });
    }

    // Grava ANTES de responder: se o banco falhar, devolvemos 500 para o Anota AI reenviar.
    try {
      await vendasRepository.salvar({ payloadOriginal: request.body });
      return reply.status(200).send({ received: true });
    } catch (error) {
      request.log.error({ err: error }, 'Falha ao gravar webhook no banco');
      return reply.status(500).send({ message: 'Falha ao registrar venda' });
    }
  }
}
