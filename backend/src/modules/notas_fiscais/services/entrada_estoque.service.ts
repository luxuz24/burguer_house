import { z } from 'zod';
import { prisma } from '../../../infra/database/prisma.js';
import { parsearDiaLoja } from '../../../shared/datas.js';

const dataHoraIsoSchema = z.iso.datetime({ offset: true });

function resolverDataEmissao(dataEmissao: string | Date | undefined): Date {
  if (dataEmissao === undefined) {
    return new Date();
  }
  if (dataEmissao instanceof Date) {
    if (Number.isNaN(dataEmissao.getTime())) {
      throw new Error('Data de emissão inválida');
    }
    return dataEmissao;
  }
  const texto = typeof dataEmissao === 'string' ? dataEmissao.trim() : '';
  const diaLoja = parsearDiaLoja(texto, 'inicio');
  if (diaLoja) {
    return diaLoja;
  }
  if (dataHoraIsoSchema.safeParse(texto).success) {
    return new Date(texto);
  }
  throw new Error('Data de emissão inválida');
}

export interface ItemConfirmadoEntrada {
  insumoId: string;
  quantidade: number;
  valorUnitario?: number | undefined;
  descricaoOriginal?: string | undefined;
  unidadeOriginal?: string | undefined;
  quantidadeOriginal?: number | undefined;
  valorTotal?: number | undefined;
}

export interface EntradaEstoqueInput {
  chaveAcesso?: string | undefined;
  numero?: string | undefined;
  serie?: string | undefined;
  fornecedorNome?: string | undefined;
  fornecedorCnpj?: string | undefined;
  valorTotal?: number | undefined;
  dataEmissao?: string | Date | undefined;
  itens: ItemConfirmadoEntrada[];
}

export class NotaDuplicadaError extends Error {
  constructor(chaveAcesso: string) {
    super(`A nota fiscal com chave de acesso ${chaveAcesso} já foi importada anteriormente`);
    this.name = 'NotaDuplicadaError';
  }
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

    const dataEmissaoNota = resolverDataEmissao(input.dataEmissao);

    try {
      return await this.db.$transaction(async (tx) => {
        // Se houver chave de acesso informada, garante idempotência (não importar nota duplicada)
        if (input.chaveAcesso) {
          const jaExiste = await tx.notaFiscal.findUnique({
            where: { chaveAcesso: input.chaveAcesso },
          });

          if (jaExiste) {
            throw new NotaDuplicadaError(input.chaveAcesso);
          }
        }

        const atualizados: Array<{
          id: string;
          nome: string;
          novoEstoque: number;
          adicionado: number;
          custoUnitario: number;
        }> = [];

        for (const item of itensValidos) {
          const insumo = await tx.insumo.findUnique({
            where: { id: item.insumoId },
          });

          if (!insumo) {
            throw new Error(`Insumo com ID ${item.insumoId} não encontrado no banco de dados`);
          }

          const dataUpdate: { estoqueAtual: { increment: number }; custoUnitario?: number } = {
            estoqueAtual: {
              increment: item.quantidade,
            },
          };

          // Se o valor unitário foi fornecido, atualiza o custo unitário do insumo
          if (item.valorUnitario !== undefined && item.valorUnitario > 0) {
            dataUpdate.custoUnitario = item.valorUnitario;
          }

          const atualizado = await tx.insumo.update({
            where: { id: item.insumoId },
            data: dataUpdate,
          });

          atualizados.push({
            id: atualizado.id,
            nome: atualizado.nome,
            novoEstoque: atualizado.estoqueAtual,
            adicionado: item.quantidade,
            custoUnitario: atualizado.custoUnitario,
          });
        }

        let notaFiscalId: string | null = null;
        // A nota é sempre registrada quando há chave de acesso (é a chave de idempotência), mesmo que o fornecedor
        // não tenha sido identificado (ex.: QR code sem scraping): sem isso, reimportar a mesma nota duplicaria o estoque.
        if (input.chaveAcesso) {
          const valorTotalCalculado = input.valorTotal ?? itensValidos.reduce(
            (acc, it) => acc + (it.valorTotal ?? (it.quantidade * (it.valorUnitario ?? 0))),
            0
          );

          const notaCriada = await tx.notaFiscal.create({
            data: {
              chaveAcesso: input.chaveAcesso,
              numero: input.numero ?? null,
              serie: input.serie ?? null,
              fornecedorNome: input.fornecedorNome?.trim() || 'Fornecedor não identificado',
              fornecedorCnpj: input.fornecedorCnpj ?? '',
              valorTotal: valorTotalCalculado,
              dataEmissao: dataEmissaoNota,
              itens: {
                create: itensValidos.map((it) => ({
                  insumoId: it.insumoId,
                  descricaoOriginal: it.descricaoOriginal ?? 'Item faturado',
                  unidadeOriginal: it.unidadeOriginal ?? 'UN',
                  quantidadeOriginal: it.quantidadeOriginal ?? it.quantidade,
                  valorUnitario: it.valorUnitario ?? 0,
                  valorTotal: it.valorTotal ?? (it.quantidade * (it.valorUnitario ?? 0)),
                  quantidadeConvertida: it.quantidade,
                })),
              },
            },
          });

          notaFiscalId = notaCriada.id;
        }

        return {
          notaFiscalId,
          chaveAcesso: input.chaveAcesso ?? null,
          fornecedorNome: input.fornecedorNome ?? null,
          totalItensProcessados: atualizados.length,
          insumosAtualizados: atualizados,
        };
      });
    } catch (error) {
      // Importação simultânea da mesma nota: a constraint única da chave de acesso barra a segunda (rollback completo).
      if ((error as { code?: string })?.code === 'P2002' && input.chaveAcesso) {
        throw new NotaDuplicadaError(input.chaveAcesso);
      }
      throw error;
    }
  }

  async listarNotasFiscais(limit = 50) {
    return this.db.notaFiscal.findMany({
      take: limit,
      orderBy: { dataEmissao: 'desc' },
      include: {
        itens: {
          include: {
            insumo: {
              select: {
                id: true,
                nome: true,
                unidade: true,
              },
            },
          },
        },
      },
    });
  }
}
