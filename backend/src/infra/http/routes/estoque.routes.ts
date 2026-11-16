import { type FastifyInstance } from 'fastify';
import { EstoqueController } from '../controllers/estoque.controller.js';

export async function estoqueRoutes(app: FastifyInstance) {
  const controller = new EstoqueController();

  app.post('/entradas-manuais', controller.registrarEntradaManual.bind(controller));
  app.get('/movimentacoes', controller.listarMovimentacoes.bind(controller));
}
