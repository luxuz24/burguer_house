import { type FastifyInstance } from 'fastify';
import { InsumosController } from '../controllers/insumos.controller.js';

export async function insumosRoutes(app: FastifyInstance) {
  const controller = new InsumosController();

  app.post('/', controller.criar.bind(controller));
  app.get('/', controller.listar.bind(controller));
  app.get('/alertas', controller.alertas.bind(controller));
  app.get('/:id', controller.buscarPorId.bind(controller));
  app.put('/:id', controller.atualizar.bind(controller));
  app.delete('/:id', controller.deletar.bind(controller));
}
