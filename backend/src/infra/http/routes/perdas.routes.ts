import { type FastifyInstance } from 'fastify';
import { PerdasController } from '../controllers/perdas.controller.js';

export async function perdasRoutes(app: FastifyInstance) {
  const controller = new PerdasController();

  app.post('/', controller.criar.bind(controller));
  app.get('/', controller.listar.bind(controller));
  app.get('/resumo-mensal', controller.resumoMensal.bind(controller));
}
