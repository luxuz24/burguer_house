import { prisma } from '../../../infra/database/prisma.js';
import type { MotivoPerda } from '../../../../generated/prisma/client.js';
import { obterIntervaloMesLoja } from '../../../shared/datas.js';

export class InsumoNaoEncontradoError extends Error {
  constructor() {
    super('Insumo não encontrado');
  }
}

export class QuantidadeInvalidaError extends Error {
  constructor(message = 'Quantidade da perda deve ser maior que zero') {
    super(message);
    this.name = 'QuantidadeInvalidaError';
  }
}

export class PerdasRepository {
  constructor(private readonly db = prisma) {}

  async registrar(data: { insumoId: string; quantidade: number; motivo: MotivoPerda }) {
    if (!Number.isFinite(data.quantidade) || data.quantidade <= 0) {
      throw new QuantidadeInvalidaError();
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

      // Grava o custoUnitario histórico do insumo no momento do registro da perda
      const perda = await tx.perda.create({
        data: {
          insumoId: data.insumoId,
          quantidade: data.quantidade,
          motivo: data.motivo,
          custoUnitario: insumo.custoUnitario,
        },
        include: { insumo: true },
      });
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
   * Soma ocorrências e valor financeiro (R$) por motivo no mês no fuso da loja (America/Campo_Grande),
   * baseado no custo unitário histórico gravado na própria perda.
   */
  async resumoMensal(ano: number, mes: number) {
    const { inicio, fim } = obterIntervaloMesLoja(ano, mes);

    const perdas = await this.db.perda.findMany({
      where: { criadoEm: { gte: inicio, lt: fim } },
      include: { insumo: true },
    });

    const mapaMotivos = new Map<MotivoPerda, { ocorrencias: number; valorTotal: number; perdasSemCusto: number }>();

    for (const perda of perdas) {
      const atual = mapaMotivos.get(perda.motivo) ?? { ocorrencias: 0, valorTotal: 0, perdasSemCusto: 0 };
      const custoUnitario =
        perda.custoUnitario !== undefined && perda.custoUnitario !== null
          ? perda.custoUnitario
          : (perda.insumo?.custoUnitario ?? 0);
      const custo = custoUnitario * perda.quantidade;
      atual.ocorrencias += 1;
      atual.valorTotal += custo;
      if (custoUnitario === 0) {
        atual.perdasSemCusto += 1;
      }
      mapaMotivos.set(perda.motivo, atual);
    }

    return Array.from(mapaMotivos.entries()).map(([motivo, dados]) => ({
      motivo,
      ocorrencias: dados.ocorrencias,
      valorTotal: Number(dados.valorTotal.toFixed(2)),
      perdasSemCusto: dados.perdasSemCusto,
    }));
  }
}
