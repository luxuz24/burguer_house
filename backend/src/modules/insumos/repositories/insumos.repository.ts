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
    // Retorna apenas itens onde o estoqueAtual é menor ou igual ao estoqueMinimo
    return prisma.$queryRaw`SELECT * FROM "insumos" WHERE "estoqueAtual" <= "estoqueMinimo" ORDER BY "nome" ASC`;
  }
}