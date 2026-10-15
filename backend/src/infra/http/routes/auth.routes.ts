import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { criarRateLimit } from '../rate_limit.js';

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  // Rota pública de login: 10 tentativas por IP a cada 15 minutos (força bruta)
  const limiteLogin = criarRateLimit({ max: 10, janelaMs: 15 * 60 * 1000 });
  app.post('/login', { onRequest: [limiteLogin] }, controller.login);

  // Rotas autenticadas via Bearer Token JWT
  app.get('/me', { onRequest: [app.authenticate] }, controller.me);
  app.put('/perfil', { onRequest: [app.authenticate] }, controller.atualizarPerfil);
  app.put('/senha', { onRequest: [app.authenticate] }, controller.atualizarSenha);
}
