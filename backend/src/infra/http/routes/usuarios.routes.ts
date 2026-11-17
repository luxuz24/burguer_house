import type { FastifyInstance } from 'fastify';
import { UsuariosController } from '../controllers/usuarios.controller.js';
import { exigirRole } from '../role.guard.js';

export async function usuariosRoutes(app: FastifyInstance) {
  const controller = new UsuariosController();

  // Decisão do dono (17/11/2026): só ADMIN cadastra e gerencia usuários.
  // preHandler (e não onRequest): depende do authGuard global, que sincroniza o papel do banco.
  app.addHook('preHandler', exigirRole('ADMIN'));

  app.get('/', controller.listar);
  app.post('/', controller.criar);
  app.patch('/:id', controller.atualizar);
  app.post('/:id/senha', controller.redefinirSenha);
}
