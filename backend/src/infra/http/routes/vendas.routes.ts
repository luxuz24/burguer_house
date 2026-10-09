import type { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller.js';
import { ConsolidacaoController } from '../controllers/consolidacao.controller.js';

const webhookController = new WebhookController();
const consolidacaoController = new ConsolidacaoController();

export async function vendasRoutes(app: FastifyInstance) {
  // Recebe o payload do sistema de pdv (Anota AI)
  app.post('/webhook/anota-ai', webhookController.receberAnotaAi.bind(webhookController));

  // Dispara a consolidação das vendas processadas no dia
  app.post('/vendas/consolidar', consolidacaoController.executar.bind(consolidacaoController));
}
