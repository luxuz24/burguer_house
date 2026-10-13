import { prisma } from '../../../infra/database/prisma.js';

export class SubFichasTecnicasRepository {
  constructor(private readonly db = prisma) {}

  async vincular(data: { insumoBeneficiadoId: string; insumoBrutoId: string; quantidadeNecessaria: number }) {
    return this.db.subFichaTecnica.upsert({
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
  }

  async listarPorBeneficiado(insumoBeneficiadoId: string) {
    return this.db.subFichaTecnica.findMany({
      where: { insumoBeneficiadoId },
      include: { insumoBruto: true },
    });
  }

  async remover(id: string) {
    return this.db.subFichaTecnica.delete({ where: { id } });
  }
}
