import { prisma } from '../../../infra/database/prisma.js';
import { extrairItens } from './extrair_itens.js';
import { classificarVenda } from './estado_pedido.js';

class ConsolidacaoConcorrenteError extends Error {}

const TENTATIVAS_MAXIMAS = 3;

export interface ResultadoConsolidacao {
  consolidadas: number;
  insumosAfetados?: number;
  /** vendas pendentes cujo payload não trouxe nenhum item válido (marcadas como processadas, sem abater estoque) */
  vendasSemItens?: number;
  /** pedidos cancelados/negados: marcados como processados, SEM abater estoque */
  canceladasIgnoradas?: number;
  /** pedidos ainda não aceitos/agendados: continuam pendentes para a próxima consolidação */
  vendasAguardando?: number;
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
    // Se as vendas mudaram entre a leitura e a reivindicação (outra consolidação ou novo evento do pedido),
    // a transação é desfeita sem efeito e relemos o estado atual; normalmente a 2ª tentativa já resolve.
    for (let tentativa = 1; tentativa <= TENTATIVAS_MAXIMAS; tentativa++) {
      try {
        return await this.consolidarUmaVez();
      } catch (error) {
        if (!(error instanceof ConsolidacaoConcorrenteError)) throw error;
      }
    }
    return { consolidadas: 0, mensagem: 'As vendas continuaram mudando durante a consolidação; será tentado de novo na próxima execução.' };
  }

  private async consolidarUmaVez(): Promise<ResultadoConsolidacao> {
    return this.db.$transaction(
      async (tx) => {
        const pendentes = await tx.venda.findMany({ where: { processado: false } });
        if (pendentes.length === 0) {
          return { consolidadas: 0, mensagem: 'Nenhuma venda pendente de processamento.' };
        }

        // O webhook avisa mudanças de estado do pedido: só abate o que foi aceito, descarta o cancelado
        // e deixa pendente o que ainda não foi aceito (um novo evento deve atualizar o estado até lá).
        const aAbater = pendentes.filter((v) => classificarVenda(v.payloadOriginal) === 'abater');
        const aIgnorar = pendentes.filter((v) => classificarVenda(v.payloadOriginal) === 'ignorar');
        const aguardando = pendentes.length - aAbater.length - aIgnorar.length;
        const aReivindicar = [...aAbater, ...aIgnorar];

        if (aReivindicar.length === 0) {
          return {
            consolidadas: 0,
            vendasAguardando: aguardando,
            mensagem: 'Nenhuma venda pronta para consolidar (pedidos ainda não aceitos ficam pendentes).',
          };
        }

        // Reivindica cada venda exatamente como foi lida (id + atualizadoEm): se outra execução a consolidou OU
        // chegou um novo evento do pedido (ex.: cancelamento) depois da leitura, a contagem não bate e refazemos.
        const reivindicadas = await tx.venda.updateMany({
          where: {
            processado: false,
            OR: aReivindicar.map((v) => ({ id: v.id, atualizadoEm: v.atualizadoEm })),
          },
          data: { processado: true },
        });
        if (reivindicadas.count !== aReivindicar.length) throw new ConsolidacaoConcorrenteError();

        const produtos = await tx.produto.findMany({
          include: { fichasTecnicas: { include: { insumo: true } } },
        });
        const produtoPorNome = new Map(produtos.map((p) => [p.nome.trim().toLowerCase(), p]));

        const descontosPorInsumo = new Map<string, number>();
        const naoEncontrados = new Set<string>();
        let vendasSemItens = 0;

        for (const venda of aAbater) {
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
          consolidadas: aReivindicar.length,
          insumosAfetados: descontosPorInsumo.size,
          vendasSemItens,
          canceladasIgnoradas: aIgnorar.length,
          vendasAguardando: aguardando,
          produtosNaoEncontrados: [...naoEncontrados],
          insumosComEstoqueNegativo: negativos,
        };
      },
      // Neon pode estar acordando (cold start) e o lote pode ser grande
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
