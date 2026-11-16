import { prisma } from '../../../infra/database/prisma.js';
import { planejarConsolidacao } from './planejar_consolidacao.js';

class ConsolidacaoConcorrenteError extends Error {}

const TENTATIVAS_MAXIMAS = 3;

export interface DescontoPrevistoItem {
  insumoId: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  desconto: number;
  estoqueProjetado: number;
}

export interface PlanoModoSombra {
  totalPendentesAnalisadas: number;
  vendasAAbater: number;
  canceladasIgnoradas: number;
  vendasAguardando: number;
  vendasSemItens: number;
  vendasComItensInvalidos: number;
  vendasPendentesNaoMapeadas: number;
  produtosNaoEncontrados: string[];
  produtosSemFicha: string[];
  produtosComColisaoNome: string[];
  descontosPrevistos: DescontoPrevistoItem[];
}

export function modoSombraAtivo(): boolean {
  return process.env.ANOTAAI_MODO_SOMBRA?.trim().toLowerCase() === 'true';
}

function resumirDiagnostico(plano: ReturnType<typeof planejarConsolidacao>) {
  return {
    vendasSemItens: plano.vendasSemItens.length > 0 ? plano.vendasSemItens.length : undefined,
    vendasComItensInvalidos: plano.vendasComItensInvalidos.length > 0 ? plano.vendasComItensInvalidos.length : undefined,
    vendasAguardando: plano.vendasAguardando.length > 0 ? plano.vendasAguardando.length : undefined,
    vendasPendentesNaoMapeadas: plano.vendasPendentesNaoMapeadas > 0 ? plano.vendasPendentesNaoMapeadas : undefined,
    produtosNaoEncontrados: plano.produtosNaoEncontrados.length > 0 ? plano.produtosNaoEncontrados : undefined,
    produtosSemFicha: plano.produtosSemFicha.length > 0 ? plano.produtosSemFicha : undefined,
    produtosComColisaoNome: plano.produtosComColisaoNome.length > 0 ? plano.produtosComColisaoNome : undefined,
  };
}

export interface ResultadoConsolidacao {
  consolidadas: number;
  modoSombra?: boolean | undefined;
  plano?: PlanoModoSombra | undefined;
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
        const pendentes = await tx.venda.findMany({
          where: { processado: false, origem: 'WEBHOOK' },
        });
        const emModoSombra = modoSombraAtivo();
        if (pendentes.length === 0) {
          return {
            consolidadas: 0,
            ...(emModoSombra ? { modoSombra: true } : {}),
            mensagem: emModoSombra
              ? 'Modo sombra ativo: nenhuma venda pendente para simular.'
              : 'Nenhuma venda pendente de processamento.',
          };
        }

        const produtos = await tx.produto.findMany({
          include: { fichasTecnicas: { include: { insumo: true } } },
        });

        const plano = planejarConsolidacao(pendentes, produtos);

        if (emModoSombra) {
          const descontosPrevistos: DescontoPrevistoItem[] = [];
          const negativos: NonNullable<ResultadoConsolidacao['insumosComEstoqueNegativo']> = [];
          for (const [, info] of plano.descontosPorInsumo) {
            const desconto = Number(info.desconto.toFixed(4));
            const estoqueProjetado = Number((info.estoqueAtual - desconto).toFixed(4));
            descontosPrevistos.push({
              insumoId: info.insumoId,
              nome: info.nome,
              unidade: info.unidade,
              estoqueAtual: info.estoqueAtual,
              desconto,
              estoqueProjetado,
            });
            if (estoqueProjetado < 0) {
              negativos.push({
                id: info.insumoId,
                nome: info.nome,
                estoqueAtual: estoqueProjetado,
              });
            }
          }

          return {
            consolidadas: 0,
            modoSombra: true,
            insumosAfetados: plano.descontosPorInsumo.size,
            canceladasIgnoradas: plano.vendasAIgnorar.length > 0 ? plano.vendasAIgnorar.length : undefined,
            ...resumirDiagnostico(plano),
            insumosComEstoqueNegativo: negativos.length > 0 ? negativos : undefined,
            plano: {
              totalPendentesAnalisadas: pendentes.length,
              vendasAAbater: plano.vendasAAbater.length,
              canceladasIgnoradas: plano.vendasAIgnorar.length,
              vendasAguardando: plano.vendasAguardando.length,
              vendasSemItens: plano.vendasSemItens.length,
              vendasComItensInvalidos: plano.vendasComItensInvalidos.length,
              vendasPendentesNaoMapeadas: plano.vendasPendentesNaoMapeadas,
              produtosNaoEncontrados: plano.produtosNaoEncontrados,
              produtosSemFicha: plano.produtosSemFicha,
              produtosComColisaoNome: plano.produtosComColisaoNome,
              descontosPrevistos,
            },
            mensagem: 'Modo sombra ativo: simulação concluída sem alterar estoque ou vendas.',
          };
        }

        const aReivindicar = [...plano.vendasAAbater, ...plano.vendasAIgnorar];

        if (aReivindicar.length === 0) {
          return {
            consolidadas: 0,
            ...resumirDiagnostico(plano),
            mensagem: 'Nenhuma venda pronta para consolidar.',
          };
        }

        // Reivindica apenas vendas 100% elegíveis (abater ou ignorar)
        const reivindicadas = await tx.venda.updateMany({
          where: {
            processado: false,
            origem: 'WEBHOOK',
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
          canceladasIgnoradas: plano.vendasAIgnorar.length > 0 ? plano.vendasAIgnorar.length : undefined,
          ...resumirDiagnostico(plano),
          insumosComEstoqueNegativo: negativos.length > 0 ? negativos : undefined,
        };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
