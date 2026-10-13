import { type FastifyInstance } from 'fastify';
import { PreparoInternoController } from '../controllers/preparo_interno.controller.js';

export async function preparoInternoRoutes(app: FastifyInstance) {
  const controller = new PreparoInternoController();

  app.post('/sub-fichas', controller.vincular.bind(controller));
  app.get('/sub-fichas/:insumoBeneficiadoId', controller.listar.bind(controller));
  app.delete('/sub-fichas/:id', controller.remover.bind(controller));
  app.post('/produzir', controller.produzir.bind(controller));
}
