import { prisma } from '../../../infra/database/prisma.js';
import type { MotivoPerda } from '../../../../generated/prisma/client.js';

export class InsumoNaoEncontradoError extends Error {
  constructor() {
    super('Insumo não encontrado');
  }
}

export class PerdasRepository {
  constructor(private readonly db = prisma) {}

  async registrar(data: { insumoId: string; quantidade: number; motivo: MotivoPerda }) {
    return this.db.$transaction(async (tx) => {
      const insumo = await tx.insumo.findUnique({ where: { id: data.insumoId } });
      if (!insumo) throw new InsumoNaoEncontradoError();

      await tx.insumo.update({
        where: { id: data.insumoId },
        data: { estoqueAtual: { decrement: data.quantidade } },
      });

      return tx.perda.create({ data, include: { insumo: true } });
    });
  }

  async listarRecentes(limite = 50) {
    return this.db.perda.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
      include: { insumo: true },
    });
  }

  /**
   * Soma quantidade e valor por motivo no mês. O modelo Insumo não tem custo
   * unitário, então "valor" ainda não existe: retorna quantidade e ocorrências.
   */
  async resumoMensal(ano: number, mes: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));

    const grupos = await this.db.perda.groupBy({
      by: ['motivo'],
      where: { criadoEm: { gte: inicio, lt: fim } },
      _sum: { quantidade: true },
      _count: { _all: true },
    });

    return grupos.map((g) => ({
      motivo: g.motivo,
      quantidadeTotal: g._sum.quantidade ?? 0,
      ocorrencias: g._count._all,
    }));
  }
}
