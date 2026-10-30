import { prisma } from '../../../infra/database/prisma.js';

export class InsumoBeneficiadoNaoEncontradoError extends Error {
  constructor() {
    super('Insumo beneficiado não encontrado');
  }
}

export class InsumoBrutoNaoEncontradoError extends Error {
  constructor() {
    super('Insumo bruto não encontrado');
  }
}

export class InsumoNaoBeneficiadoError extends Error {
  constructor() {
    super('Insumo não é marcado como produzido internamente');
  }
}

export class SubFichaNaoEncontradaError extends Error {
  constructor() {
    super('Ingrediente da sub-ficha não encontrado');
  }
}

export class SubFichasTecnicasRepository {
  constructor(private readonly db = prisma) {}

  async vincular(data: { insumoBeneficiadoId: string; insumoBrutoId: string; quantidadeNecessaria: number }) {
    const beneficiado = await this.db.insumo.findUnique({ where: { id: data.insumoBeneficiadoId } });
    if (!beneficiado) throw new InsumoBeneficiadoNaoEncontradoError();
    if (!beneficiado.produzidoInternamente) throw new InsumoNaoBeneficiadoError();

    const bruto = await this.db.insumo.findUnique({ where: { id: data.insumoBrutoId } });
    if (!bruto) throw new InsumoBrutoNaoEncontradoError();

    try {
      return await this.db.subFichaTecnica.upsert({
        where: {
          insumoBeneficiadoId_insumoBrutoId: {
            insumoBeneficiadoId: data.insumoBeneficiadoId,
            insumoBrutoId: data.insumoBrutoId,
          },
        },
        create: data,
        update: {
          quantidadeNecessaria: data.quantidadeNecessaria,
        },
        include: { insumoBruto: true },
      });
    } catch (err: any) {
      if (err?.code === 'P2003') {
        throw new InsumoBrutoNaoEncontradoError();
      }
      throw err;
    }
  }

  async listarPorBeneficiado(insumoBeneficiadoId: string) {
    return this.db.subFichaTecnica.findMany({
      where: { insumoBeneficiadoId },
      include: { insumoBruto: true },
    });
  }

  async remover(id: string) {
    try {
      return await this.db.subFichaTecnica.delete({ where: { id } });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        throw new SubFichaNaoEncontradaError();
      }
      throw err;
    }
  }
}
