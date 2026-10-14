import { prisma } from '../../../infra/database/prisma.js';

export interface ItemConfirmadoEntrada {
  insumoId: string;
  quantidade: number;
  valorUnitario?: number | undefined;
}

export interface EntradaEstoqueInput {
  chaveAcesso?: string | undefined;
  fornecedorNome?: string | undefined;
  fornecedorCnpj?: string | undefined;
  itens: ItemConfirmadoEntrada[];
}

export class EntradaEstoqueService {
  constructor(private readonly db = prisma) {}

  async confirmarEntrada(input: EntradaEstoqueInput) {
    if (!input.itens || input.itens.length === 0) {
      throw new Error('Nenhum item informado para entrada de estoque');
    }

    // Filtra itens válidos com quantidade positiva
    const itensValidos = input.itens.filter((it) => it.insumoId && it.quantidade > 0);
    if (itensValidos.length === 0) {
      throw new Error('Nenhum insumo válido com quantidade maior que zero foi selecionado');
    }

    return this.db.$transaction(async (tx) => {
      const atualizados: Array<{ id: string; nome: string; novoEstoque: number; adicionado: number }> = [];

      for (const item of itensValidos) {
        const insumo = await tx.insumo.findUnique({
          where: { id: item.insumoId },
        });

        if (!insumo) {
          throw new Error(`Insumo com ID ${item.insumoId} não encontrado no banco de dados`);
        }

        const atualizado = await tx.insumo.update({
          where: { id: item.insumoId },
          data: {
            estoqueAtual: {
              increment: item.quantidade,
            },
          },
        });

        atualizados.push({
          id: atualizado.id,
          nome: atualizado.nome,
          novoEstoque: atualizado.estoqueAtual,
          adicionado: item.quantidade,
        });
      }

      return {
        chaveAcesso: input.chaveAcesso ?? null,
        fornecedorNome: input.fornecedorNome ?? null,
        totalItensProcessados: atualizados.length,
        insumosAtualizados: atualizados,
      };
    });
  }
}
