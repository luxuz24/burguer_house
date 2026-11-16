import type { FastifyInstance } from 'fastify';
import { WebhookController } from '../controllers/webhook.controller.js';
import { ConsolidacaoController } from '../controllers/consolidacao.controller.js';
import { VendasRetidasController } from '../controllers/vendas_retidas.controller.js';
import { MarcarVendasTratadasController } from '../controllers/marcar_vendas_tratadas.controller.js';
import { FechamentoManualController } from '../controllers/fechamento_manual.controller.js';
import { EstornarFechamentoController } from '../controllers/estornar_fechamento.controller.js';

const webhookController = new WebhookController();
const consolidacaoController = new ConsolidacaoController();
const vendasRetidasController = new VendasRetidasController();
const marcarVendasTratadasController = new MarcarVendasTratadasController();
const fechamentoManualController = new FechamentoManualController();
const estornarFechamentoController = new EstornarFechamentoController();

export async function vendasRoutes(app: FastifyInstance) {
  // Recebe o payload do sistema de pdv (Anota AI); limite próprio de 512 KB para pedidos grandes
  app.post('/webhook/anota-ai', { bodyLimit: 512 * 1024 }, webhookController.receberAnotaAi.bind(webhookController));

  // Dispara a consolidação das vendas processadas no dia
  app.post('/vendas/consolidar', consolidacaoController.executar.bind(consolidacaoController));

  // Lista vendas retidas por inconsistência de cardápio/payload para resolução no painel
  app.get('/vendas/retidas', vendasRetidasController.listar.bind(vendasRetidasController));

  // Marca vendas pendentes até uma data como já tratadas (ex.: encerramento de modo sombra) sem abater estoque
  app.post('/vendas/marcar-tratadas', marcarVendasTratadasController.executar.bind(marcarVendasTratadasController));

  // Fechamento manual do dia: simulação (somente leitura), confirmação atômica e estorno
  app.post('/vendas/fechamento-manual/simulacao', fechamentoManualController.simular.bind(fechamentoManualController));
  app.post('/vendas/fechamento-manual', fechamentoManualController.confirmar.bind(fechamentoManualController));
  app.post('/vendas/:id/estornar', estornarFechamentoController.estornar.bind(estornarFechamentoController));
}
