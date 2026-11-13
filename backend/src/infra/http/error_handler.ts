import type { FastifyError, FastifyInstance } from 'fastify';
import { z } from 'zod';

function codigoPrisma(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code) ? code : null;
}

/**
 * Tratamento central de erros: controllers podem simplesmente deixar a exceção subir.
 *  - ZodError → 400 · Prisma P2025 → 404 · P2003 → 409 · P2002 → 409 · P2023 → 400
 *  - Erros 4xx do próprio Fastify (JSON inválido, content-type não suportado...) mantêm o status.
 *  - Qualquer outro erro → 500 genérico (o detalhe vai só para o log, nunca para o cliente).
 */
export function registrarErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ message: 'Dados inválidos', issues: error.issues });
    }

    switch (codigoPrisma(error)) {
      case 'P2025':
        return reply.status(404).send({ message: 'Registro não encontrado' });
      case 'P2003':
        return reply
          .status(409)
          .send({ message: 'Operação não permitida: existem registros vinculados a este item' });
      case 'P2002':
        return reply.status(409).send({ message: 'Já existe um registro com estes dados' });
      case 'P2023':
        return reply.status(400).send({ message: 'Identificador inválido' });
    }

    if ((error as FastifyError).code === 'FST_ERR_CTP_BODY_TOO_LARGE' || (error as FastifyError).statusCode === 413) {
      return reply.status(413).send({ message: 'Corpo da requisição excede o limite máximo permitido' });
    }

    const status = (error as FastifyError).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(status).send({ message: error.message });
    }

    request.log.error({ err: error }, 'Erro não tratado');
    return reply.status(500).send({ message: 'Erro interno no servidor' });
  });
}
