import { prisma } from '../../../infra/database/prisma.js';
import { planejarConsolidacao } from './planejar_consolidacao.js';

class ConsolidacaoConcorrenteError extends Error {}

const TENTATIVAS_MAXIMAS = 3;

export interface ResultadoConsolidacao {
  consolidadas: number;
  insumosAfetados?: number | undefined;
  /** vendas pendentes cujo payload não trouxe nenhum item válido */
  vendasSemItens?: number | undefined;
  /** vendas com itens inválidos (ex.: sem quantidade legível) */
  vendasComItensInvalidos?: number | undefined;
  /** pedidos cancelados/negados: marcados como processados, SEM abater estoque */
  canceladasIgnoradas?: number | undefined;
  /** pedidos ainda não aceitos/agendados: continuam pendentes para a próxima consolidação */
  vendasAguardando?: number | undefined;
  /** vendas que não puderam ser consolidadas por conterem produtos não encontrados ou inconsistências cadastrais */
  vendasPendentesNaoMapeadas?: number | undefined;
  produtosNaoEncontrados?: string[] | undefined;
  produtosSemFicha?: string[] | undefined;
  produtosComColisaoNome?: string[] | undefined;
  /** insumos que ficaram com estoque negativo após o abatimento (a venda já aconteceu; o saldo está defasado) */
  insumosComEstoqueNegativo?: Array<{ id: string; nome: string; estoqueAtual: number }> | undefined;
  mensagem?: string | undefined;
}

export class ConsolidacaoService {
  constructor(private readonly db = prisma) {}

  /**
   * Consolida as vendas pendentes. Executa em transação com retry para concorrência.
   * Utiliza a função pura planejarConsolidacao para determinar com precisão
   * quais vendas podem ser concluídas e quais devem permanecer pendentes (zero falhas silenciosas).
   */
  async consolidarVendasDoDia(): Promise<ResultadoConsolidacao> {
    for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
      try {
        return await this.consolidarUmaVez();
      } catch (error) {
        if (!(error instanceof ConsolidacaoConcorrenteError)) throw error;
      }
    }
    return {
      consolidadas: 0,
      mensagem: 'As vendas continuaram mudando durante a consolidação; será tentado de novo na próxima execução.',
    };
  }

  private async consolidarUmaVez(): Promise<ResultadoConsolidacao> {
    return this.db.$transaction(
      async (tx) => {
        const pendentes = await tx.venda.findMany({ where: { processado: false } });
        if (pendentes.length === 0) {
          return { consolidadas: 0, mensagem: 'Nenhuma venda pendente de processamento.' };
        }

        const produtos = await tx.produto.findMany({
          include: { fichasTecnicas: { include: { insumo: true } } },
        });

        const plano = planejarConsolidacao(pendentes, produtos);

        const aReivindicar = [...plano.vendasAAbater, ...plano.vendasAIgnorar];

        if (aReivindicar.length === 0) {
          return {
            consolidadas: 0,
            vendasAguardando: plano.vendasAguardando.length > 0 ? plano.vendasAguardando.length : undefined,
            vendasSemItens: plano.vendasSemItens.length > 0 ? plano.vendasSemItens.length : undefined,
            vendasComItensInvalidos: plano.vendasComItensInvalidos.length > 0 ? plano.vendasComItensInvalidos.length : undefined,
            vendasPendentesNaoMapeadas: plano.vendasPendentesNaoMapeadas > 0 ? plano.vendasPendentesNaoMapeadas : undefined,
            produtosNaoEncontrados: plano.produtosNaoEncontrados.length > 0 ? plano.produtosNaoEncontrados : undefined,
            produtosSemFicha: plano.produtosSemFicha.length > 0 ? plano.produtosSemFicha : undefined,
            produtosComColisaoNome: plano.produtosComColisaoNome.length > 0 ? plano.produtosComColisaoNome : undefined,
            mensagem: 'Nenhuma venda pronta para consolidar.',
          };
        }

        // Reivindica apenas vendas 100% elegíveis (abater ou ignorar)
        const reivindicadas = await tx.venda.updateMany({
          where: {
            processado: false,
            OR: aReivindicar.map((v) => ({ id: v.id, atualizadoEm: v.atualizadoEm })),
          },
          data: { processado: true },
        });
        if (reivindicadas.count !== aReivindicar.length) {
          throw new ConsolidacaoConcorrenteError();
        }

        // Aplica o decremento de insumos com arredondamento seguro de 4 casas
        const negativos: NonNullable<ResultadoConsolidacao['insumosComEstoqueNegativo']> = [];
        for (const [, info] of plano.descontosPorInsumo) {
          const quantidadeArredondada = Number(info.desconto.toFixed(4));
          const atualizado = await tx.insumo.update({
            where: { id: info.insumoId },
            data: { estoqueAtual: { decrement: quantidadeArredondada } },
          });
          if (atualizado.estoqueAtual < 0) {
            negativos.push({
              id: atualizado.id,
              nome: atualizado.nome,
              estoqueAtual: atualizado.estoqueAtual,
            });
          }
        }

        return {
          consolidadas: aReivindicar.length,
          insumosAfetados: plano.descontosPorInsumo.size,
          vendasSemItens: plano.vendasSemItens.length > 0 ? plano.vendasSemItens.length : undefined,
          vendasComItensInvalidos: plano.vendasComItensInvalidos.length > 0 ? plano.vendasComItensInvalidos.length : undefined,
          canceladasIgnoradas: plano.vendasAIgnorar.length > 0 ? plano.vendasAIgnorar.length : undefined,
          vendasAguardando: plano.vendasAguardando.length > 0 ? plano.vendasAguardando.length : undefined,
          vendasPendentesNaoMapeadas: plano.vendasPendentesNaoMapeadas > 0 ? plano.vendasPendentesNaoMapeadas : undefined,
          produtosNaoEncontrados: plano.produtosNaoEncontrados.length > 0 ? plano.produtosNaoEncontrados : undefined,
          produtosSemFicha: plano.produtosSemFicha.length > 0 ? plano.produtosSemFicha : undefined,
          produtosComColisaoNome: plano.produtosComColisaoNome.length > 0 ? plano.produtosComColisaoNome : undefined,
          insumosComEstoqueNegativo: negativos.length > 0 ? negativos : undefined,
        };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
