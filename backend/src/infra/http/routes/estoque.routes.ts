import { type FastifyInstance } from 'fastify';
import { EstoqueController } from '../controllers/estoque.controller.js';
import { SaidaDiaController } from '../controllers/saida_dia.controller.js';

export async function estoqueRoutes(app: FastifyInstance) {
  const controller = new EstoqueController();
  const saidaDiaController = new SaidaDiaController();

  app.post('/entradas-manuais', controller.registrarEntradaManual.bind(controller));
  app.get('/movimentacoes', controller.listarMovimentacoes.bind(controller));
  app.get('/saida-dia', saidaDiaController.obter.bind(saidaDiaController));
}
