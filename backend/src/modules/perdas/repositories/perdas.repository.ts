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
    if (!Number.isFinite(data.quantidade) || data.quantidade <= 0) {
      throw new Error('Quantidade da perda deve ser maior que zero');
    }

    return this.db.$transaction(async (tx) => {
      const insumo = await tx.insumo.findUnique({ where: { id: data.insumoId } });
      if (!insumo) throw new InsumoNaoEncontradoError();

      // Perda é um fato já ocorrido: sempre registra, mesmo que o saldo do sistema esteja defasado.
      // O decremento é atômico (SQL `x = x - n`); se o saldo ficar negativo, sinaliza para o operador conferir.
      await tx.insumo.update({
        where: { id: data.insumoId },
        data: { estoqueAtual: { decrement: data.quantidade } },
      });

      const perda = await tx.perda.create({ data, include: { insumo: true } });
      return { ...perda, estoqueNegativo: perda.insumo.estoqueAtual < 0 };
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
   * Soma quantidade, ocorrências e valor financeiro (R$) por motivo no mês
   * com base no custo unitário atual do insumo descartado.
   */
  async resumoMensal(ano: number, mes: number) {
    const inicio = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(ano, mes, 1));

    const perdas = await this.db.perda.findMany({
      where: { criadoEm: { gte: inicio, lt: fim } },
      include: { insumo: true },
    });

    const mapaMotivos = new Map<MotivoPerda, { quantidadeTotal: number; ocorrencias: number; valorTotal: number }>();

    for (const perda of perdas) {
      const atual = mapaMotivos.get(perda.motivo) ?? { quantidadeTotal: 0, ocorrencias: 0, valorTotal: 0 };
      const custo = (perda.insumo?.custoUnitario ?? 0) * perda.quantidade;
      atual.quantidadeTotal += perda.quantidade;
      atual.ocorrencias += 1;
      atual.valorTotal += custo;
      mapaMotivos.set(perda.motivo, atual);
    }

    return Array.from(mapaMotivos.entries()).map(([motivo, dados]) => ({
      motivo,
      quantidadeTotal: Number(dados.quantidadeTotal.toFixed(2)),
      ocorrencias: dados.ocorrencias,
      valorTotal: Number(dados.valorTotal.toFixed(2)),
    }));
  }
}
