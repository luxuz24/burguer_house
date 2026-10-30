import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '../../../generated/prisma/client.js';

/**
 * Middleware de autorização por papel (RBAC).
 * Exige que o usuário autenticado tenha um dos papéis informados.
 *
 * ATENÇÃO: DEVE ser configurado como `preHandler` (e NÃO `onRequest`), pois depende
 * do `authGuard` global (que roda em `preParsing`) para validar o token JWT e sincronizar
 * o papel atualizado do usuário a partir do banco de dados.
 *
 * Se o usuário não estiver autenticado -> 401 Unauthorized.
 * Se o papel for insuficiente -> 403 Forbidden.
 */
export function exigirRole(...rolesPermitidos: Role[]) {
  return async function autorizar(request: FastifyRequest, reply: FastifyReply) {
    const roleUsuario = request.user?.role as Role | undefined;

    if (!roleUsuario || !rolesPermitidos.includes(roleUsuario)) {
      return reply.status(403).send({
        message: 'Acesso negado: privilégios insuficientes',
      });
    }
  };
}
