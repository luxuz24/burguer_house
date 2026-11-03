import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  InsumosRepository,
  ConflitoUnidadeInsumoError,
} from '../../../modules/insumos/repositories/insumos.repository.js';

const idParamSchema = z.object({ id: z.string().uuid('ID de insumo inválido') });

// Campos sem default: base da atualização parcial. O saldo (estoqueAtual) NÃO é editável via PUT
// para evitar que edições cadastrais sobrescrevam baixas de perdas, vendas ou entradas de NF em concorrência.
const camposAtualizacaoInsumo = {
  nome: z.string().trim().min(1, 'O nome é obrigatório'),
  unidade: z.string().trim().min(1, 'A unidade é obrigatória'),
  fatorPerda: z
    .number()
    .min(0, 'O fator de perda não pode ser negativo')
    .max(1, 'O fator de perda deve ser no máximo 1 (100%)'),
  custoUnitario: z.number().min(0),
  estoqueMinimo: z.number().min(0),
  produzidoInternamente: z.boolean(),
  validadeDias: z.number().int().positive().nullable(),
};

const criarInsumoSchema = z.object({
  ...camposAtualizacaoInsumo,
  estoqueAtual: z.number().min(0, 'O estoque inicial não pode ser negativo').default(0),
  fatorPerda: camposAtualizacaoInsumo.fatorPerda.default(0),
  custoUnitario: camposAtualizacaoInsumo.custoUnitario.optional(),
  estoqueMinimo: camposAtualizacaoInsumo.estoqueMinimo.default(0),
  produzidoInternamente: camposAtualizacaoInsumo.produzidoInternamente.optional(),
  validadeDias: camposAtualizacaoInsumo.validadeDias.optional(),
});

const atualizarInsumoSchema = z
  .object(camposAtualizacaoInsumo)
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
    try {
      const insumo = await new InsumosRepository().atualizar(id, data);
      return reply.send(insumo);
    } catch (err) {
      if (err instanceof ConflitoUnidadeInsumoError) {
        return reply.status(409).send({ message: err.message });
      }
      throw err;
    }
  }

  async deletar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await new InsumosRepository().deletar(id);
    return reply.status(204).send();
  }
}
