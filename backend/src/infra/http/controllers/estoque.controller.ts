import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  EntradaManualService,
  EntradaManualError,
} from '../../../modules/estoque/services/entrada_manual.service.js';
import {
  AjusteEstoqueService,
  AjusteEstoqueError,
} from '../../../modules/estoque/services/ajuste_estoque.service.js';

const itemEntradaSchema = z.object({
  insumoId: z.string().uuid('ID de insumo inválido'),
  quantidade: z.number().finite().positive('A quantidade deve ser maior que zero'),
  custoUnitario: z.number().finite().min(0, 'O custo unitário não pode ser negativo').optional(),
});

const criarEntradaManualSchema = z
  .object({
    chaveIdempotencia: z
      .string()
      .trim()
      .min(8, 'A chave de idempotência deve ter no mínimo 8 caracteres')
      .max(100, 'A chave de idempotência deve ter no máximo 100 caracteres'),
    observacao: z
      .string()
      .trim()
      .max(500, 'A observação deve ter no máximo 500 caracteres')
      .optional(),
    itens: z
      .array(itemEntradaSchema)
      .min(1, 'Informe ao menos um item')
      .max(100, 'Máximo de 100 itens por lançamento'),
  })
  .superRefine((data, ctx) => {
    const vistos = new Set<string>();
    data.itens.forEach((item, index) => {
      if (vistos.has(item.insumoId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['itens', index, 'insumoId'],
          message: 'Não é permitido repetir o mesmo insumo na mesma requisição',
        });
      }
      vistos.add(item.insumoId);
    });
  });

const criarAjusteSchema = z
  .object({
    chaveIdempotencia: z
      .string()
      .trim()
      .min(8, 'A chave de idempotência deve ter no mínimo 8 caracteres')
      .max(100, 'A chave de idempotência deve ter no máximo 100 caracteres'),
    motivo: z
      .string()
      .trim()
      .min(3, 'Informe o motivo do ajuste (mínimo 3 caracteres)')
      .max(500, 'O motivo deve ter no máximo 500 caracteres'),
    itens: z
      .array(
        z.object({
          insumoId: z.string().uuid('ID de insumo inválido'),
          saldoContado: z.number().finite().min(0, 'O saldo contado não pode ser negativo'),
        }),
      )
      .min(1, 'Informe ao menos um item')
      .max(200, 'Máximo de 200 itens por contagem'),
  })
  .superRefine((data, ctx) => {
    const vistos = new Set<string>();
    data.itens.forEach((item, index) => {
      if (vistos.has(item.insumoId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['itens', index, 'insumoId'],
          message: 'Não é permitido repetir o mesmo insumo na mesma requisição',
        });
      }
      vistos.add(item.insumoId);
    });
  });

const listarMovimentacoesQuerySchema = z.object({
  insumoId: z.string().uuid('ID de insumo inválido').optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export class EstoqueController {
  async registrarEntradaManual(request: FastifyRequest, reply: FastifyReply) {
    const parsed = criarEntradaManualSchema.parse(request.body);
    const usuarioId = request.user?.sub ?? null;

    try {
      const resultado = await new EntradaManualService().registrarEntradaManual({
        ...parsed,
        usuarioId,
      });
      return reply.status(resultado.reaproveitado ? 200 : 201).send(resultado);
    } catch (error) {
      if (error instanceof EntradaManualError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }

  async registrarAjuste(request: FastifyRequest, reply: FastifyReply) {
    const parsed = criarAjusteSchema.parse(request.body);
    const usuarioId = request.user?.sub ?? null;

    try {
      const resultado = await new AjusteEstoqueService().registrarAjuste({ ...parsed, usuarioId });
      return reply.status(resultado.reaproveitado ? 200 : 201).send(resultado);
    } catch (error) {
      if (error instanceof AjusteEstoqueError) {
        return reply.status(error.status).send({ message: error.message });
      }
      throw error;
    }
  }

  async listarMovimentacoes(request: FastifyRequest, reply: FastifyReply) {
    const query = listarMovimentacoesQuerySchema.parse(request.query ?? {});
    const resultado = await new EntradaManualService().listarMovimentacoes(query);
    return reply.send(resultado);
  }
}
