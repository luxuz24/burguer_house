import { prisma } from '../../../infra/database/prisma.js';
import { normalizarNomeProduto } from '../../../shared/nomes.js';

export class ConflitoNomeProdutoError extends Error {
  constructor(public readonly produtoConflito: { id: string; nome: string }) {
    super(`Já existe um produto com nome equivalente cadastrado: "${produtoConflito.nome}"`);
  }
}

export class ProdutosRepository {
  constructor(private readonly db = prisma) {}

  async buscarPorNomeNormalizado(nome: string, ignorarId?: string) {
    const alvo = normalizarNomeProduto(nome);
    if (!alvo) return null;
    const produtos = await this.db.produto.findMany({
      select: { id: true, nome: true },
    });
    return produtos.find((p) => p.id !== ignorarId && normalizarNomeProduto(p.nome) === alvo) ?? null;
  }

  async criar(data: { nome: string }) {
    const conflito = await this.buscarPorNomeNormalizado(data.nome);
    if (conflito) {
      throw new ConflitoNomeProdutoError(conflito);
    }
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
      include: {
        fichasTecnicas: {
          include: { insumo: true },
          orderBy: { insumo: { nome: 'asc' } },
        },
      },
    });
  }

  async atualizar(id: string, data: { nome: string }) {
    const conflito = await this.buscarPorNomeNormalizado(data.nome, id);
    if (conflito) {
      throw new ConflitoNomeProdutoError(conflito);
    }
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
