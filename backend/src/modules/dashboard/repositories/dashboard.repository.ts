import { prisma } from '../../../infra/database/prisma.js';

export class DashboardRepository {
  async buscarPerdasPorPeriodo(dataInicio: Date, dataFim: Date) {
    return prisma.perda.findMany({
      where: {
        criadoEm: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      include: {
        insumo: {
          select: {
            id: true,
            nome: true,
            unidade: true,
            custoUnitario: true,
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async buscarVendasProcessadasPorPeriodo(dataInicio: Date, dataFim: Date) {
    return prisma.venda.findMany({
      where: {
        processado: true,
        criadoEm: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      select: {
        id: true,
        criadoEm: true,
        payloadOriginal: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async buscarNotasFiscaisPorPeriodo(dataInicio: Date, dataFim: Date) {
    return prisma.notaFiscal.findMany({
      where: {
        dataEmissao: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      orderBy: {
        dataEmissao: 'desc',
      },
    });
  }

  async buscarInsumos() {
    return prisma.insumo.findMany({
      select: {
        id: true,
        nome: true,
        unidade: true,
        categoria: true,
        estoqueAtual: true,
        estoqueMinimo: true,
        custoUnitario: true,
        produzidoInternamente: true,
        validadeDias: true,
        atualizadoEm: true,
      },
      orderBy: {
        estoqueAtual: 'asc',
      },
    });
  }

  async buscarProdutosComFichas() {
    return prisma.produto.findMany({
      include: {
        fichasTecnicas: {
          include: {
            insumo: {
              select: {
                id: true,
                nome: true,
                unidade: true,
                fatorPerda: true,
                custoUnitario: true,
              },
            },
          },
        },
      },
    });
  }
}
