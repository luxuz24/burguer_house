import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { InsumosRepository } from '../../../modules/insumos/repositories/insumos.repository.js';

const idParamSchema = z.object({ id: z.string().uuid('ID de insumo inválido') });

// Campos sem default: base da atualização parcial (um default aqui sobrescreveria campos não enviados).
const camposInsumo = {
  nome: z.string().trim().min(1, 'O nome é obrigatório'),
  unidade: z.string().trim().min(1, 'A unidade é obrigatória'),
  fatorPerda: z.number().min(0),
  custoUnitario: z.number().min(0),
  estoqueAtual: z.number(),
  estoqueMinimo: z.number().min(0),
  produzidoInternamente: z.boolean(),
  validadeDias: z.number().int().positive().nullable(),
};

const criarInsumoSchema = z.object({
  ...camposInsumo,
  fatorPerda: camposInsumo.fatorPerda.default(0),
  custoUnitario: camposInsumo.custoUnitario.optional(),
  estoqueAtual: camposInsumo.estoqueAtual.default(0),
  estoqueMinimo: camposInsumo.estoqueMinimo.default(0),
  produzidoInternamente: camposInsumo.produzidoInternamente.optional(),
  validadeDias: camposInsumo.validadeDias.optional(),
});

const atualizarInsumoSchema = z
  .object(camposInsumo)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Informe ao menos um campo para atualizar' });

export class InsumosController {
  async criar(request: FastifyRequest, reply: FastifyReply) {
    const data = criarInsumoSchema.parse(request.body);
    const insumo = await new InsumosRepository().criar(data);
    return reply.status(201).send(insumo);
  }

  async listar(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await new InsumosRepository().listarTodos());
  }

  async buscarPorId(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const insumo = await new InsumosRepository().buscarPorId(id);
    if (!insumo) {
      return reply.status(404).send({ message: 'Insumo não encontrado' });
    }
    return reply.send(insumo);
  }

  async alertas(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await new InsumosRepository().listarAlertas());
  }

  async atualizar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const data = atualizarInsumoSchema.parse(request.body);
    return reply.send(await new InsumosRepository().atualizar(id, data));
  }

  async deletar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await new InsumosRepository().deletar(id);
    return reply.status(204).send();
  }
}
