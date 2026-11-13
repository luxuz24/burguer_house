import type { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller.js';
import { ConsolidacaoController } from '../controllers/consolidacao.controller.js';
import { VendasRetidasController } from '../controllers/vendas_retidas.controller.js';

const webhookController = new WebhookController();
const consolidacaoController = new ConsolidacaoController();
const vendasRetidasController = new VendasRetidasController();

export async function vendasRoutes(app: FastifyInstance) {
  // Recebe o payload do sistema de pdv (Anota AI)
  app.post('/webhook/anota-ai', webhookController.receberAnotaAi.bind(webhookController));

  // Dispara a consolidação das vendas processadas no dia
  app.post('/vendas/consolidar', consolidacaoController.executar.bind(consolidacaoController));

  // Lista vendas retidas por inconsistência de cardápio/payload para resolução no painel
  app.get('/vendas/retidas', vendasRetidasController.listar.bind(vendasRetidasController));
}
