import { prisma } from '../../../infra/database/prisma.js';

export interface SalvarVendaInput {
  payloadOriginal: any;
}

export class VendasRepository {
  async salvar(input: SalvarVendaInput) {
    return prisma.venda.create({
      data: {
        payloadOriginal: input.payloadOriginal,
        processado: false
      }
    });
  }

  async buscarNaoProcessadas() {
    return prisma.venda.findMany({
      where: {
        processado: false
      }
    });
  }

  async marcarComoProcessada(id: string) {
    return prisma.venda.update({
      where: { id },
      data: { processado: true }
    });
  }
}
