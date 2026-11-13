import { isDeepStrictEqual } from 'node:util';
import { prisma } from '../../../infra/database/prisma.js';

export interface SalvarVendaInput {
  payloadOriginal: unknown;
  externalId?: string | null | undefined;
}

export class VendasRepository {
  /**
   * Grava o evento do pedido. O webhook da Anota AI avisa cada mudança de estado do MESMO pedido (aceito,
   * atualizado, cancelado), todas com o mesmo ID. Por isso, para um ID já conhecido:
   *  - venda ainda pendente (não consolidada): o evento mais recente SUBSTITUI o payload (vale o último estado);
   *  - venda já consolidada: o estoque já foi abatido, então o payload é mantido (não reescreve o histórico);
   *  - evento idêntico (reenvio): nada muda.
   */
  async salvar(input: SalvarVendaInput) {
    const externalId = input.externalId ?? null;
    try {
      const venda = await prisma.venda.create({
        data: {
          externalId,
          payloadOriginal: (input.payloadOriginal ?? null) as any,
          processado: false,
        },
      });
      return { venda, duplicada: false, atualizada: false };
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002' && externalId) {
        const existente = await prisma.venda.findUnique({ where: { externalId } });
        if (!existente) throw error;

        let atualizada = false;
        if (!existente.processado && !isDeepStrictEqual(existente.payloadOriginal, input.payloadOriginal)) {
          // O filtro processado=false protege contra uma consolidação que acabou de reivindicar a venda.
          const resultado = await prisma.venda.updateMany({
            where: { id: existente.id, processado: false },
            data: { payloadOriginal: (input.payloadOriginal ?? null) as any },
          });
          atualizada = resultado.count > 0;
        }
        return { venda: existente, duplicada: true, atualizada };
      }
      throw error;
    }
  }

  async buscarNaoProcessadas(opts?: { take?: number; skip?: number }) {
    return prisma.venda.findMany({
      where: {
        processado: false,
      },
      orderBy: { criadoEm: 'asc' },
      ...(opts?.take !== undefined ? { take: opts.take } : {}),
      ...(opts?.skip !== undefined ? { skip: opts.skip } : {}),
    });
  }

  async contarNaoProcessadas() {
    return prisma.venda.count({
      where: { processado: false },
    });
  }

  async buscarProdutosComFichas() {
    return prisma.produto.findMany({
      include: { fichasTecnicas: { include: { insumo: true } } },
    });
  }

  async marcarComoProcessada(id: string) {
    return prisma.venda.update({
      where: { id },
      data: { processado: true },
    });
  }
}
