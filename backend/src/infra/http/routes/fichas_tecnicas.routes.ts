import { type FastifyInstance } from 'fastify';
import { FichasTecnicasController } from '../controllers/fichas_tecnicas.controller.js';

export async function fichasTecnicasRoutes(app: FastifyInstance) {
  const controller = new FichasTecnicasController();

  app.post('/', controller.criar.bind(controller));
  app.get('/produto/:produtoId', controller.listarPorProduto.bind(controller));
  app.put('/:id', controller.atualizar.bind(controller));
  app.delete('/:id', controller.deletar.bind(controller));
}
