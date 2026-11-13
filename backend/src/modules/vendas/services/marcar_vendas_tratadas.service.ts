import { prisma } from '../../../infra/database/prisma.js';
import { parsearDiaLoja } from '../../../shared/datas.js';

export class MarcarVendasTratadasError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'MarcarVendasTratadasError';
  }
}

export interface MarcarVendasTratadasInput {
  ate: string;
  motivo: string;
}

export interface ResultadoMarcarTratadas {
  marcadas: number;
  ate: string;
}

export interface RegistroTratamentoPayload {
  motivo: string;
  ate: string;
  marcadoEm: string;
}

/**
 * Acrescenta os metadados de tratamento em `_tratamento` preservando os campos originais
 * do payload JSON da venda (ou encapsulando o valor caso o payload não seja um objeto simples).
 */
export function anexarTratamentoPayload(
  payloadOriginal: unknown,
  tratamento: RegistroTratamentoPayload,
): Record<string, unknown> {
  if (payloadOriginal !== null && typeof payloadOriginal === 'object' && !Array.isArray(payloadOriginal)) {
    return {
      ...(payloadOriginal as Record<string, unknown>),
      _tratamento: tratamento,
    };
  }
  return {
    valorOriginal: payloadOriginal ?? null,
    _tratamento: tratamento,
  };
}

export class MarcarVendasTratadasService {
  constructor(private readonly db = prisma) {}

  /**
   * Marca como processadas (sem abater estoque) todas as vendas pendentes criadas até o
   * fim do dia `ate` (23:59:59.999 no fuso America/Campo_Grande). Idempotente.
   */
  async executar(input: MarcarVendasTratadasInput): Promise<ResultadoMarcarTratadas> {
    const ate = input.ate.trim();
    const fimDoDia = parsearDiaLoja(ate, 'fim');
    if (!fimDoDia) {
      throw new MarcarVendasTratadasError('Data inválida; use o formato AAAA-MM-DD', 400);
    }

    const motivo = input.motivo.trim();
    if (!motivo) {
      throw new MarcarVendasTratadasError('Motivo é obrigatório', 400);
    }

    const marcadoEm = new Date().toISOString();

    const marcadas = await this.db.$transaction(async (tx) => {
      const pendentes = await tx.venda.findMany({
        where: {
          processado: false,
          criadoEm: { lte: fimDoDia },
        },
        select: { id: true, payloadOriginal: true },
      });

      let totalMarcadas = 0;
      for (const venda of pendentes) {
        const resultado = await tx.venda.updateMany({
          where: { id: venda.id, processado: false },
          data: {
            processado: true,
            payloadOriginal: anexarTratamentoPayload(venda.payloadOriginal, {
              motivo,
              ate,
              marcadoEm,
            }) as any,
          },
        });
        totalMarcadas += resultado.count;
      }

      return totalMarcadas;
    });

    return { marcadas, ate };
  }
}
