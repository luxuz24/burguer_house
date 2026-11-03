import { prisma } from '../../../infra/database/prisma.js';

type InsumoData = {
  nome: string;
  unidade: string;
  fatorPerda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  custoUnitario?: number | undefined;
  produzidoInternamente?: boolean | undefined;
  validadeDias?: number | null | undefined;
};

type InsumoAtualizacao = { [K in keyof InsumoData]?: InsumoData[K] | undefined };

// Remove chaves undefined (exactOptionalPropertyTypes + Prisma: "não enviado" = chave ausente)
function semUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export class InsumosRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: InsumoData) {
    return this.db.insumo.create({ data: semUndefined(data) as Parameters<typeof this.db.insumo.create>[0]['data'] });
  }

  async buscarPorId(id: string) {
    return this.db.insumo.findUnique({
      where: { id },
    });
  }

  async listarTodos() {
    return this.db.insumo.findMany({ 
      orderBy: { nome: 'asc' } 
    });
  }

  async listarAlertas() {
    return this.db.$queryRaw`SELECT * FROM "insumos" WHERE "estoqueAtual" <= "estoqueMinimo" ORDER BY "nome" ASC`;
  }

  async atualizar(id: string, data: InsumoAtualizacao) {
    return this.db.insumo.update({
      where: { id },
      data: semUndefined(data) as Parameters<typeof this.db.insumo.update>[0]['data'],
    });
  }

  async deletar(id: string) {
    return this.db.insumo.delete({
      where: { id }
    });
  }
}
