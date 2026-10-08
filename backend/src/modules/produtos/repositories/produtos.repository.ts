import { prisma } from '../../../infra/database/prisma.js';

export class ProdutosRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: { nome: string }) {
    return this.db.produto.create({ data });
  }

  async listarTodos() {
    return this.db.produto.findMany({ 
      orderBy: { nome: 'asc' } 
    });
  }

  async buscarPorId(id: string) {
    return this.db.produto.findUnique({
      where: { id },
      include: { fichasTecnicas: { include: { insumo: true } } }
    });
  }

  async atualizar(id: string, data: { nome: string }) {
    return this.db.produto.update({
      where: { id },
      data
    });
  }

  async deletar(id: string) {
    return this.db.produto.delete({
      where: { id }
    });
  }
}
