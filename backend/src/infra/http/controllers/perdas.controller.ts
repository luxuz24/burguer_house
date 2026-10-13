import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  PerdasRepository,
  InsumoNaoEncontradoError,
} from '../../../modules/perdas/repositories/perdas.repository.js';

const criarSchema = z.object({
  insumoId: z.string().uuid(),
  quantidade: z.number().positive(),
  motivo: z.enum(['VENCIMENTO', 'ERRO_PREPARO', 'ESTRAGADO', 'OUTRO']),
});

const listarSchema = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

const resumoSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getUTCFullYear()),
  mes: z.coerce.number().int().min(1).max(12).default(() => new Date().getUTCMonth() + 1),
});

export class PerdasController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const parsed = criarSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', issues: parsed.error.issues });
    }

    try {
      const perda = await new PerdasRepository().registrar(parsed.data);
      return reply.status(201).send(perda);
    } catch (error) {
      if (error instanceof InsumoNaoEncontradoError) {
        return reply.status(404).send({ message: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao registrar perda' });
    }
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const parsed = listarSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Parâmetros inválidos', issues: parsed.error.issues });
    }

    try {
      return reply.send(await new PerdasRepository().listarRecentes(parsed.data.limite));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao listar perdas' });
    }
  }

  async resumoMensal(request: FastifyRequest, reply: FastifyReply) {
    const parsed = resumoSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Parâmetros inválidos', issues: parsed.error.issues });
    }

    try {
      const { ano, mes } = parsed.data;
      const porMotivo = await new PerdasRepository().resumoMensal(ano, mes);
      return reply.send({ ano, mes, porMotivo });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao gerar resumo mensal de perdas' });
    }
  }
}
