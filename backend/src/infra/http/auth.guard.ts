import type { FastifyInstance } from 'fastify';

// Rotas que não exigem JWT (webhook tem autenticação própria por segredo).
const ROTAS_PUBLICAS = new Set([
  '/health',
  '/api/auth/login',
  '/api/webhook/anota-ai',
]);

/**
 * Hook global: exige JWT válido em tudo, exceto rotas públicas.
 * Autorização por role (quem pode o quê) é um passo posterior, definido com o produto.
 */
export function registrarAuthGuard(app: FastifyInstance) {
  // preParsing: roda depois do onRequest do CORS (respostas 401 mantêm headers CORS)
  // e antes do parse do body (não processa payload de quem não está autenticado).
  app.addHook('preParsing', async (request, reply) => {
    if (request.method === 'OPTIONS') return;

    const path = (request.url.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
    if (ROTAS_PUBLICAS.has(path)) return;

    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ message: 'Token JWT inválido ou ausente' });
    }
  });
}
