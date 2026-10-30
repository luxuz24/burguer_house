import type { FastifyReply, FastifyRequest } from 'fastify';
import { Role } from '../../../generated/prisma/client.js';

/**
 * Middleware de autorização por papel (RBAC).
 * Exige que o usuário autenticado tenha um dos papéis informados.
 * Se o papel for insuficiente, responde com 403 Forbidden.
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
