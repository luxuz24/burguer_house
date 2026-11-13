import type { FastifyInstance } from 'fastify';
import { NotasFiscaisController } from '../controllers/notas_fiscais.controller.js';

export async function notasFiscaisRoutes(app: FastifyInstance) {
  const controller = new NotasFiscaisController();

  app.get('/', controller.listar.bind(controller));
  // XML de até 500 KB escapado em JSON pode chegar perto de 1 MiB
  app.post('/parser-xml', { bodyLimit: 1024 * 1024 }, controller.parseXml.bind(controller));
  app.post('/parser-qrcode', controller.parseQrcode.bind(controller));
  app.post('/confirmar', controller.confirmar.bind(controller));
}
