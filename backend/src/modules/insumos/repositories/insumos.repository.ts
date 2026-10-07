import { prisma } from '../../../infra/database/prisma.js';

export class InsumosRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: { nome: string; unidade: string; fatorPerda: number; estoqueAtual: number; estoqueMinimo: number }) {
    return this.db.insumo.create({ data });
  }

  async listarTodos() {
    return this.db.insumo.findMany({ 
      orderBy: { nome: 'asc' } 
    });
  }

  async listarAlertas() {
    return this.db.$queryRaw`SELECT * FROM "insumos" WHERE "estoqueAtual" <= "estoqueMinimo" ORDER BY "nome" ASC`;
  }

  async atualizar(id: string, data: Partial<{ nome: string; unidade: string; fatorPerda: number; estoqueAtual: number; estoqueMinimo: number }>) {
    return this.db.insumo.update({
      where: { id },
      data
    });
  }

  async deletar(id: string) {
    return this.db.insumo.delete({
      where: { id }
    });
  }
}
