import { prisma } from '../../../infra/database/prisma.js';

export interface SalvarVendaInput {
  payloadOriginal: any;
  externalId?: string | null | undefined;
}

export class VendasRepository {
  async salvar(input: SalvarVendaInput) {
    const externalId = input.externalId ?? null;
    try {
      const venda = await prisma.venda.create({
        data: {
          externalId,
          payloadOriginal: input.payloadOriginal,
          processado: false,
        },
      });
      return { venda, duplicada: false };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002' && externalId) {
        const existente = await prisma.venda.findUnique({ where: { externalId } });
        return { venda: existente, duplicada: true };
      }
      throw error;
    }
  }

  async buscarNaoProcessadas() {
    return prisma.venda.findMany({
      where: {
        processado: false,
      },
    });
  }

  async marcarComoProcessada(id: string) {
    return prisma.venda.update({
      where: { id },
      data: { processado: true },
    });
  }
}
