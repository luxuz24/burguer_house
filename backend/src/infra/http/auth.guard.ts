import type { FastifyInstance } from 'fastify';
import { UsuariosRepository } from '../../modules/auth/repositories/usuarios.repository.js';

// Rotas que não exigem JWT. Webhook e consolidação têm autenticação própria por segredo
// (ANOTAAI_WEBHOOK_SECRET e CRON_SECRET), validada no controller.
const ROTAS_PUBLICAS = new Set([
  '/health',
  '/api/auth/login',
  '/api/webhook/anota-ai',
  '/api/vendas/consolidar',
]);

/**
 * Hook global: exige JWT válido e ativo em tudo, exceto rotas públicas.
 * - Valida assinatura e expiração do token JWT.
 * - Confere no banco se o usuário existe e permanece ativo.
 * - Confere se a versão do token (tv) bate com a do banco (revogação imediata pós-troca de senha/logout).
 * - Sincroniza request.user.role com o papel real e atual no banco.
 */
export function registrarAuthGuard(app: FastifyInstance, usuariosRepo = new UsuariosRepository()) {
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

    const usuario = await usuariosRepo.buscarStatusToken(request.user.sub);
    if (!usuario || !usuario.ativo) {
      return reply.status(401).send({ message: 'Usuário não encontrado ou inativo' });
    }

    if (request.user.tv === undefined || usuario.tokenVersion !== request.user.tv) {
      return reply.status(401).send({ message: 'Token revogado. Faça login novamente.' });
    }

    request.user.role = usuario.role;
  });
}
