import { type FastifyInstance } from 'fastify';
import { ProdutosController } from '../controllers/produtos.controller.js';

export async function produtosRoutes(app: FastifyInstance) {
  const controller = new ProdutosController();

  app.post('/', controller.criar.bind(controller));
  app.get('/', controller.listar.bind(controller));
  app.get('/:id', controller.buscarPorId.bind(controller));
  app.put('/:id', controller.atualizar.bind(controller));
  app.delete('/:id', controller.deletar.bind(controller));
}
