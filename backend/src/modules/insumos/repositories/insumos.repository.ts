import { prisma } from '../../../infra/database/prisma.js';

export class InsumosRepository {
  async criar(data: { nome: string; unidade: string; fatorPerda: number; estoqueAtual: number; estoqueMinimo: number }) {
    return prisma.insumo.create({ data });
  }

  async listarTodos() {
    return prisma.insumo.findMany({ 
      orderBy: { nome: 'asc' } 
    });
  }

  async listarAlertas() {
    return prisma.$queryRaw`SELECT * FROM "insumos" WHERE "estoqueAtual" <= "estoqueMinimo" ORDER BY "nome" ASC`;
  }

  async atualizar(id: string, data: Partial<{ nome: string; unidade: string; fatorPerda: number; estoqueAtual: number; estoqueMinimo: number }>) {
    return prisma.insumo.update({
      where: { id },
      data
    });
  }

  async deletar(id: string) {
    return prisma.insumo.delete({
      where: { id }
    });
  }



}
