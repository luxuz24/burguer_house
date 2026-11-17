import { prisma } from '../../../infra/database/prisma.js';
import { buscarMovimentacoesPorChave, type MovimentacaoComInsumo } from './movimentacoes_por_chave.js';

export interface ItemAjusteEstoqueInput {
  insumoId: string;
  saldoContado: number;
}

export interface RegistrarAjusteEstoqueInput {
  chaveIdempotencia: string;
  motivo: string;
  itens: ItemAjusteEstoqueInput[];
  usuarioId: string | null;
}

export interface ItemAjusteEstoqueResultado {
  insumoId: string;
  nome: string;
  unidade: string;
  saldoAnterior: number;
  saldoContado: number;
  diferenca: number;
}

export interface RegistrarAjusteEstoqueResultado {
  reaproveitado: boolean;
  chaveIdempotencia: string;
  itens: ItemAjusteEstoqueResultado[];
}

export class AjusteEstoqueError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AjusteEstoqueError';
  }
}

const MENSAGEM_CONFLITO =
  'Já existe um ajuste de estoque registrado com esta chave de idempotência e conteúdo diferente';

/**
 * Ajuste por contagem física: o saldo do insumo passa a ser o contado, e a diferença em relação ao
 * saldo do sistema fica registrada como movimentação `AJUSTE` (não é perda nem compra).
 */
export class AjusteEstoqueService {
  constructor(private readonly db = prisma) {}

  private resolverReplay(
    input: RegistrarAjusteEstoqueInput,
    motivo: string,
    existentes: MovimentacaoComInsumo[],
  ): RegistrarAjusteEstoqueResultado {
    if (existentes.length !== input.itens.length || existentes[0]?.observacao !== motivo) {
      throw new AjusteEstoqueError(MENSAGEM_CONFLITO, 409);
    }

    const porInsumo = new Map(existentes.map((m) => [m.insumoId, m]));
    const itens = input.itens.map((item) => {
      const mov = porInsumo.get(item.insumoId);
      if (!mov || mov.saldoPosterior !== item.saldoContado) {
        throw new AjusteEstoqueError(MENSAGEM_CONFLITO, 409);
      }
      return {
        insumoId: mov.insumo.id,
        nome: mov.insumo.nome,
        unidade: mov.insumo.unidade,
        saldoAnterior: mov.saldoAnterior,
        saldoContado: mov.saldoPosterior,
        diferenca: mov.quantidade,
      };
    });

    return { reaproveitado: true, chaveIdempotencia: input.chaveIdempotencia, itens };
  }

  async registrarAjuste(input: RegistrarAjusteEstoqueInput): Promise<RegistrarAjusteEstoqueResultado> {
    if (input.itens.length === 0) {
      throw new AjusteEstoqueError('Informe ao menos um item para o ajuste', 400);
    }
    const motivo = input.motivo.trim();
    if (!motivo) {
      throw new AjusteEstoqueError('Informe o motivo do ajuste', 400);
    }
    const ids = input.itens.map((it) => it.insumoId);
    if (new Set(ids).size !== ids.length) {
      throw new AjusteEstoqueError('Não é permitido repetir o mesmo insumo na mesma requisição', 400);
    }

    try {
      return await this.db.$transaction(
        async (tx) => {
          const existentes = await buscarMovimentacoesPorChave(tx, input.chaveIdempotencia);
          if (existentes.length > 0) {
            return this.resolverReplay(input, motivo, existentes);
          }

          // Lock pessimista em ordem canônica: um ajuste concorrente espera e lê o saldo já gravado,
          // então a diferença registrada nunca parte de um saldo obsoleto (e não há deadlock entre lotes).
          const travados = await tx.$queryRaw<
            Array<{ id: string; nome: string; unidade: string; estoqueAtual: number }>
          >`
            SELECT id, nome, unidade, "estoqueAtual"
            FROM insumos
            WHERE id = ANY(${ids})
            ORDER BY id
            FOR UPDATE
          `;
          const mapaInsumos = new Map(travados.map((ins) => [ins.id, ins]));

          const faltando = ids.filter((id) => !mapaInsumos.has(id));
          if (faltando.length > 0) {
            throw new AjusteEstoqueError(`Insumo(s) não encontrado(s): ${faltando.join(', ')}`, 404);
          }

          const resultados: ItemAjusteEstoqueResultado[] = [];
          const movimentacoesData = [];

          for (const item of input.itens) {
            const insumo = mapaInsumos.get(item.insumoId)!;
            const saldoAnterior = insumo.estoqueAtual;
            const diferenca = Number((item.saldoContado - saldoAnterior).toFixed(6));

            await tx.insumo.update({
              where: { id: item.insumoId },
              data: { estoqueAtual: item.saldoContado },
            });

            movimentacoesData.push({
              insumoId: item.insumoId,
              usuarioId: input.usuarioId,
              tipo: 'AJUSTE' as const,
              quantidade: diferenca,
              saldoAnterior,
              saldoPosterior: item.saldoContado,
              custoUnitario: null,
              observacao: motivo,
              chaveIdempotencia: `${input.chaveIdempotencia}:${item.insumoId}`,
            });

            resultados.push({
              insumoId: insumo.id,
              nome: insumo.nome,
              unidade: insumo.unidade,
              saldoAnterior,
              saldoContado: item.saldoContado,
              diferenca,
            });
          }

          await tx.movimentacaoEstoque.createMany({ data: movimentacoesData });

          return { reaproveitado: false, chaveIdempotencia: input.chaveIdempotencia, itens: resultados };
        },
        { timeout: 20000 },
      );
    } catch (error) {
      // Mesma chave enviada duas vezes ao mesmo tempo: a segunda transação perde no índice único e vira replay.
      if ((error as { code?: string } | null)?.code === 'P2002') {
        const existentes = await buscarMovimentacoesPorChave(this.db, input.chaveIdempotencia);
        if (existentes.length > 0) {
          return this.resolverReplay(input, motivo, existentes);
        }
      }
      throw error;
    }
  }
}
