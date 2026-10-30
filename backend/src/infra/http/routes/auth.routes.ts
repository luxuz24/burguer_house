import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { criarRateLimit } from '../rate_limit.js';

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  // Rota pública de login: 10 tentativas por IP a cada 15 minutos (força bruta)
  const limiteLogin = criarRateLimit({ max: 10, janelaMs: 15 * 60 * 1000 });
  app.post('/login', { onRequest: [limiteLogin] }, controller.login);

  // Troca de senha: 5 tentativas por usuário (não por IP) a cada 15 minutos; impede força bruta da senha atual com token roubado.
  // preHandler (e não onRequest) porque precisa do usuário já autenticado pelo guard global.
  const limiteSenha = criarRateLimit({
    max: 5,
    janelaMs: 15 * 60 * 1000,
    chave: (request) => `senha:${request.user.sub}`,
  });

  // Rotas autenticadas: protegidas globalmente pelo authGuard em preParsing
  app.get('/me', controller.me);
  app.put('/perfil', controller.atualizarPerfil);
  app.put('/senha', { preHandler: [limiteSenha] }, controller.atualizarSenha);
  app.post('/logout', controller.logout);
}
