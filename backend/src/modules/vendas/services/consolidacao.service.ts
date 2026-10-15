import { prisma } from '../../../infra/database/prisma.js';
import { extrairItens } from './extrair_itens.js';

class ConsolidacaoConcorrenteError extends Error {}

export interface ResultadoConsolidacao {
  consolidadas: number;
  insumosAfetados?: number;
  /** vendas pendentes cujo payload não trouxe nenhum item válido (marcadas como processadas, sem abater estoque) */
  vendasSemItens?: number;
  produtosNaoEncontrados?: string[];
  /** insumos que ficaram com estoque negativo após o abatimento (a venda já aconteceu; o saldo está defasado) */
  insumosComEstoqueNegativo?: Array<{ id: string; nome: string; estoqueAtual: number }>;
  mensagem?: string;
}

export class ConsolidacaoService {
  constructor(private readonly db = prisma) {}

  /**
   * Tudo acontece em UMA transação: as vendas são "reivindicadas" (processado=true condicionado a
   * processado=false) antes de abater o estoque. Duas execuções simultâneas não descontam em dobro:
   * a segunda espera o commit da primeira, enxerga 0 linhas atualizadas e aborta sem efeito.
   */
  async consolidarVendasDoDia(): Promise<ResultadoConsolidacao> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const pendentes = await tx.venda.findMany({ where: { processado: false } });
          if (pendentes.length === 0) {
            return { consolidadas: 0, mensagem: 'Nenhuma venda pendente de processamento.' };
          }

          const reivindicadas = await tx.venda.updateMany({
            where: { id: { in: pendentes.map((v) => v.id) }, processado: false },
            data: { processado: true },
          });
          if (reivindicadas.count !== pendentes.length) throw new ConsolidacaoConcorrenteError();

          const produtos = await tx.produto.findMany({
            include: { fichasTecnicas: { include: { insumo: true } } },
          });
          const produtoPorNome = new Map(produtos.map((p) => [p.nome.trim().toLowerCase(), p]));

          const descontosPorInsumo = new Map<string, number>();
          const naoEncontrados = new Set<string>();
          let vendasSemItens = 0;

          for (const venda of pendentes) {
            const itens = extrairItens(venda.payloadOriginal);
            if (itens.length === 0) {
              vendasSemItens++;
              continue;
            }

            for (const item of itens) {
              const produto = produtoPorNome.get(item.nome.toLowerCase());
              if (!produto) {
                naoEncontrados.add(item.nome);
                continue;
              }
              for (const ficha of produto.fichasTecnicas) {
                // Fator de perda é aplicado sobre a quantidade da ficha
                const desconto = ficha.quantidade * (1 + ficha.insumo.fatorPerda) * item.quantidade;
                descontosPorInsumo.set(ficha.insumoId, (descontosPorInsumo.get(ficha.insumoId) ?? 0) + desconto);
              }
            }
          }

          const negativos: NonNullable<ResultadoConsolidacao['insumosComEstoqueNegativo']> = [];
          for (const [insumoId, quantidade] of descontosPorInsumo) {
            const atualizado = await tx.insumo.update({
              where: { id: insumoId },
              data: { estoqueAtual: { decrement: quantidade } },
            });
            if (atualizado.estoqueAtual < 0) {
              negativos.push({ id: atualizado.id, nome: atualizado.nome, estoqueAtual: atualizado.estoqueAtual });
            }
          }

          return {
            consolidadas: pendentes.length,
            insumosAfetados: descontosPorInsumo.size,
            vendasSemItens,
            produtosNaoEncontrados: [...naoEncontrados],
            insumosComEstoqueNegativo: negativos,
          };
        },
        // Neon pode estar acordando (cold start) e o lote pode ser grande
        { maxWait: 10_000, timeout: 60_000 },
      );
    } catch (error) {
      if (error instanceof ConsolidacaoConcorrenteError) {
        return { consolidadas: 0, mensagem: 'Outra consolidação já processou estas vendas.' };
      }
      throw error;
    }
  }
}
