import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { SubFichasTecnicasRepository } from '../../../modules/preparo_interno/repositories/sub_fichas_tecnicas.repository.js';
import { ProducaoService, ProducaoError } from '../../../modules/preparo_interno/services/producao.service.js';

const vincularSchema = z.object({
  insumoBeneficiadoId: z.string().uuid(),
  insumoBrutoId: z.string().uuid(),
  quantidadeNecessaria: z.number().positive(),
}).refine((d) => d.insumoBeneficiadoId !== d.insumoBrutoId, {
  message: 'Insumo bruto não pode ser o próprio beneficiado',
});

const produzirSchema = z.object({
  insumoBeneficiadoId: z.string().uuid(),
  quantidade: z.number().positive(),
});

const idSchema = z.object({ id: z.string().uuid() });
const beneficiadoParamSchema = z.object({ insumoBeneficiadoId: z.string().uuid() });

export class PreparoInternoController {
  async vincular(request: FastifyRequest, reply: FastifyReply) {
    const parsed = vincularSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', issues: parsed.error.issues });
    }
    try {
      const item = await new SubFichasTecnicasRepository().vincular(parsed.data);
      return reply.status(201).send(item);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao vincular ingrediente à sub-ficha' });
    }
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    const parsed = beneficiadoParamSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Parâmetros inválidos', issues: parsed.error.issues });
    }
    try {
      const itens = await new SubFichasTecnicasRepository().listarPorBeneficiado(parsed.data.insumoBeneficiadoId);
      return reply.send(itens);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao listar sub-ficha' });
    }
  }

  async remover(request: FastifyRequest, reply: FastifyReply) {
    const parsed = idSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Parâmetros inválidos', issues: parsed.error.issues });
    }
    try {
      await new SubFichasTecnicasRepository().remover(parsed.data.id);
      return reply.status(204).send();
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao remover ingrediente da sub-ficha' });
    }
  }

  async produzir(request: FastifyRequest, reply: FastifyReply) {
    const parsed = produzirSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ message: 'Dados inválidos', issues: parsed.error.issues });
    }
    try {
      const resultado = await new ProducaoService().produzir(
        parsed.data.insumoBeneficiadoId,
        parsed.data.quantidade,
      );
      return reply.send(resultado);
    } catch (error) {
      if (error instanceof ProducaoError) {
        return reply.status(error.status).send({ message: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ message: 'Erro ao produzir item beneficiado' });
    }
  }
}
