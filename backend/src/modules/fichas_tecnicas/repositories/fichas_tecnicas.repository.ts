import { prisma } from '../../../infra/database/prisma.js';

export class FichasTecnicasRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: { produtoId: string; insumoId: string; quantidade: number }) {
    return this.db.fichaTecnica.create({ data });
  }

  async listarPorProduto(produtoId: string) {
    return this.db.fichaTecnica.findMany({ 
      where: { produtoId },
      include: {
        insumo: true,
      }
    });
  }

  async deletar(id: string) {
    return this.db.fichaTecnica.delete({
      where: { id }
    });
  }
}
