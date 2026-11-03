import { prisma } from '../../../infra/database/prisma.js';

export class ConflitoUnidadeInsumoError extends Error {
  constructor(
    message = 'Não é possível alterar a unidade de medida de um insumo que já possui vínculos ou movimentações registradas (fichas técnicas, perdas ou notas fiscais)',
  ) {
    super(message);
  }
}

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
    if (data.unidade !== undefined) {
      const atual = await this.db.insumo.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              fichasTecnicas: true,
              ingredientesBeneficio: true,
              usadoEmBeneficios: true,
              perdas: true,
              itensNotaFiscal: true,
            },
          },
        },
      });

      if (atual && data.unidade !== atual.unidade) {
        const totalVinculos =
          atual._count.fichasTecnicas +
          atual._count.ingredientesBeneficio +
          atual._count.usadoEmBeneficios +
          atual._count.perdas +
          atual._count.itensNotaFiscal;

        if (totalVinculos > 0) {
          throw new ConflitoUnidadeInsumoError();
        }
      }
    }

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
