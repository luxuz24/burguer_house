import type { FastifyRequest, FastifyReply } from 'fastify';
import { VendasRepository } from '../../../modules/vendas/repositories/vendas.repository.js';
import { extrairIdExterno } from '../../../modules/vendas/services/extrair_id_externo.js';
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

    const externalId = extrairIdExterno(
      request.body,
      request.headers as Record<string, unknown>,
    );

    if (!externalId) {
      request.log.warn('Webhook sem identificador de pedido: não é possível deduplicar nem acompanhar mudanças de estado.');
    }

    // Grava ANTES de responder: se o banco falhar, devolvemos 500 para o Anota AI reenviar.
    // Evento de um pedido já conhecido (mesmo externalId): reenvio idêntico não duplica; mudança de estado
    // (ex.: aceito -> cancelado) atualiza a venda enquanto ela ainda não foi consolidada.
    try {
      const { duplicada, atualizada } = await vendasRepository.salvar({
        payloadOriginal: request.body,
        externalId,
      });
      if (duplicada && !atualizada) {
        // Evento diferente para uma venda já consolidada: o estoque já foi abatido, registrar para conferência.
        request.log.info({ externalId }, 'Evento de pedido já conhecido: sem alteração na venda.');
      }
      return reply
        .status(200)
        .send(!duplicada ? { received: true } : atualizada ? { received: true, duplicate: true, updated: true } : { received: true, duplicate: true });
    } catch (error) {
      request.log.error({ err: error }, 'Falha ao gravar webhook no banco');
      return reply.status(500).send({ message: 'Falha ao registrar venda' });
    }
  }
}
