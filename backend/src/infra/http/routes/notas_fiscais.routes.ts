import type { FastifyInstance } from 'fastify';
import { NotasFiscaisController } from '../controllers/notas_fiscais.controller.js';

export async function notasFiscaisRoutes(app: FastifyInstance) {
  const controller = new NotasFiscaisController();

  app.get('/', controller.listar.bind(controller));
  app.post('/parser-xml', controller.parseXml.bind(controller));
  app.post('/confirmar', controller.confirmar.bind(controller));
}
