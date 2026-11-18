import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { exigirRole } from './role.guard.js';

const METODOS_DE_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Escrita liberada: a própria conta (qualquer usuário logado) e as rotas que se autenticam por segredo.
export const ESCRITA_LIBERADA = new Set([
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'PUT /api/auth/perfil',
  'PUT /api/auth/senha',
  'POST /api/webhook/anota-ai',
  'POST /api/vendas/consolidar',
]);

/**
 * Decisão do dono (18/11/2026): por enquanto só o ADMIN altera dados; GERENTE e OPERADOR só leem.
 *
 * Toda rota de escrita recebe `exigirRole('ADMIN')` como primeiro preHandler, inclusive as que forem
 * criadas depois: uma rota nova nasce restrita e só fica aberta se entrar em `ESCRITA_LIBERADA`.
 * Precisa ser registrado antes das rotas (o hook onRoute só vale para as rotas registradas depois dele).
 */
export function registrarSomenteAdminEscreve(app: FastifyInstance) {
  const somenteAdmin = exigirRole('ADMIN') as preHandlerHookHandler;

  app.addHook('onRoute', (rota) => {
    const metodos = [rota.method].flat();
    const restrita = metodos.some((m) => METODOS_DE_ESCRITA.has(m) && !ESCRITA_LIBERADA.has(`${m} ${rota.url}`));
    if (!restrita) return;

    const existentes = rota.preHandler ? [rota.preHandler].flat() : [];
    rota.preHandler = [somenteAdmin, ...existentes];
  });
}
