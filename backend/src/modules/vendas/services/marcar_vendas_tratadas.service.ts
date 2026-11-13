import { prisma } from '../../../infra/database/prisma.js';
import { obterIntervaloDiaLoja, parsearDiaLoja } from '../../../shared/datas.js';

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
  simulacao?: boolean;
}

export interface ResultadoMarcarTratadas {
  marcadas: number;
  ate: string;
  simulacao?: true;
}

export class MarcarVendasTratadasService {
  constructor(private readonly db = prisma) {}

  /**
   * Marca como processadas (sem abater estoque) todas as vendas pendentes criadas até o
   * fim do dia `ate` (23:59:59.999 no fuso America/Campo_Grande) em uma única atualização
   * SQL em lote. Rejeita data futura e suporta modo de simulação (`simulacao: true`).
   */
  async executar(input: MarcarVendasTratadasInput): Promise<ResultadoMarcarTratadas> {
    const ate = input.ate.trim();
    const fimDoDia = parsearDiaLoja(ate, 'fim');
    if (!fimDoDia) {
      throw new MarcarVendasTratadasError('Data inválida; use o formato AAAA-MM-DD', 400);
    }

    const { fim: fimHojeLoja } = obterIntervaloDiaLoja(new Date());
    if (fimDoDia.getTime() > fimHojeLoja.getTime()) {
      throw new MarcarVendasTratadasError('A data não pode ser futura', 400);
    }

    const motivo = input.motivo.trim();
    if (!motivo) {
      throw new MarcarVendasTratadasError('Motivo é obrigatório', 400);
    }

    if (input.simulacao) {
      const marcadas = await this.db.venda.count({
        where: {
          processado: false,
          criadoEm: { lte: fimDoDia },
        },
      });
      return { marcadas, ate, simulacao: true };
    }

    const marcadoEm = new Date().toISOString();
    const tratamentoJson = JSON.stringify({ motivo, ate, marcadoEm });

    const marcadas = await this.db.$executeRaw`
      UPDATE vendas
      SET
        "processado" = true,
        "payloadOriginal" = CASE
          WHEN jsonb_typeof("payloadOriginal") = 'object'
            THEN "payloadOriginal" || jsonb_build_object('_tratamento', ${tratamentoJson}::jsonb)
          ELSE jsonb_build_object(
            'valorOriginal', "payloadOriginal",
            '_tratamento', ${tratamentoJson}::jsonb
          )
        END,
        "atualizadoEm" = now()
      WHERE "processado" = false
        AND "criadoEm" <= ${fimDoDia}
    `;

    return { marcadas, ate };
  }
}
