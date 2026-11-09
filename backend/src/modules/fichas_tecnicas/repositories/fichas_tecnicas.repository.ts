import { prisma } from '../../../infra/database/prisma.js';

export class ProdutoNaoEncontradoError extends Error {
  constructor() {
    super('Produto não encontrado');
  }
}

export class InsumoNaoEncontradoError extends Error {
  constructor() {
    super('Insumo não encontrado');
  }
}

export class ItemFichaJaExisteError extends Error {
  constructor() {
    super('Este insumo já está cadastrado na ficha técnica deste produto');
  }
}

export class FichasTecnicasRepository {
  constructor(private readonly db = prisma) {}

  async criar(data: { produtoId: string; insumoId: string; quantidade: number }) {
    const produto = await this.db.produto.findUnique({ where: { id: data.produtoId } });
    if (!produto) throw new ProdutoNaoEncontradoError();

    const insumo = await this.db.insumo.findUnique({ where: { id: data.insumoId } });
    if (!insumo) throw new InsumoNaoEncontradoError();

    try {
      return await this.db.fichaTecnica.create({
        data,
        include: {
          insumo: true,
        },
      });
    } catch (err: unknown) {
      const errorWithCode = err as {
        code?: string;
        meta?: {
          field_name?: string;
          target?: string;
          driverAdapterError?: {
            constraint?: {
              index?: string;
            };
            cause?: {
              constraint?: {
                index?: string;
              };
            };
          };
        };
      };
      if (errorWithCode?.code === 'P2002') {
        throw new ItemFichaJaExisteError();
      }
      if (errorWithCode?.code === 'P2003') {
        const constraintIndex = String(
          errorWithCode.meta?.driverAdapterError?.cause?.constraint?.index ??
          errorWithCode.meta?.driverAdapterError?.constraint?.index ??
          ''
        );
        const field = String(errorWithCode.meta?.field_name ?? '');
        const target = String(errorWithCode.meta?.target ?? '');
        const fullErrStr = `${constraintIndex} ${field} ${target}`.toLowerCase();

        if (fullErrStr.includes('insumo')) {
          throw new InsumoNaoEncontradoError();
        }
        if (fullErrStr.includes('produto')) {
          throw new ProdutoNaoEncontradoError();
        }
        throw err;
      }
      throw err;
    }
  }

  async buscarPorId(id: string) {
    return this.db.fichaTecnica.findUnique({
      where: { id },
      include: {
        insumo: true,
      },
    });
  }

  async atualizar(id: string, data: { quantidade: number }) {
    return this.db.fichaTecnica.update({
      where: { id },
      data: { quantidade: data.quantidade },
      include: {
        insumo: true,
      },
    });
  }

  async listarPorProduto(produtoId: string) {
    const produto = await this.db.produto.findUnique({ where: { id: produtoId } });
    if (!produto) throw new ProdutoNaoEncontradoError();

    return this.db.fichaTecnica.findMany({ 
      where: { produtoId },
      include: {
        insumo: true,
      },
      orderBy: {
        insumo: { nome: 'asc' },
      },
    });
  }

  async deletar(id: string) {
    return this.db.fichaTecnica.delete({
      where: { id }
    });
  }
}
