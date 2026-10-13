import { prisma } from '../../../infra/database/prisma.js';

type InsumoData = {
  nome: string;
  unidade: string;
  fatorPerda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  produzidoInternamente?: boolean;
  validadeDias?: number | null;
};

export class InsumosRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: InsumoData) {
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

  async atualizar(id: string, data: Partial<InsumoData>) {
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
