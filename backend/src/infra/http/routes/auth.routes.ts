import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  // Rota pública de login
  app.post('/login', controller.login);

  // Rotas autenticadas via Bearer Token JWT
  app.get('/me', { onRequest: [app.authenticate] }, controller.me);
  app.put('/perfil', { onRequest: [app.authenticate] }, controller.atualizarPerfil);
  app.put('/senha', { onRequest: [app.authenticate] }, controller.atualizarSenha);
}
