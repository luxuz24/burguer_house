import { prisma } from '../../../infra/database/prisma.js';
import { extrairItens } from './extrair_itens.js';
import type { ItemVenda } from './extrair_itens.js';
import { classificarVenda } from './estado_pedido.js';
import { normalizarNomeProduto } from './anotaai.adapter.js';

class ConsolidacaoConcorrenteError extends Error {}

const TENTATIVAS_MAXIMAS = 3;

export interface ResultadoConsolidacao {
  consolidadas: number;
  insumosAfetados?: number | undefined;
  /** vendas pendentes cujo payload não trouxe nenhum item válido (não são consolidadas, continuam pendentes para conferência) */
  vendasSemItens?: number | undefined;
  /** pedidos cancelados/negados: marcados como processados, SEM abater estoque */
  canceladasIgnoradas?: number | undefined;
  /** pedidos ainda não aceitos/agendados: continuam pendentes para a próxima consolidação */
  vendasAguardando?: number | undefined;
  /** vendas que não puderam ser consolidadas por conterem produtos não encontrados no catálogo */
  vendasPendentesNaoMapeadas?: number | undefined;
  produtosNaoEncontrados?: string[] | undefined;
  /** insumos que ficaram com estoque negativo após o abatimento (a venda já aconteceu; o saldo está defasado) */
  insumosComEstoqueNegativo?: Array<{ id: string; nome: string; estoqueAtual: number }> | undefined;
  mensagem?: string | undefined;
}

export class ConsolidacaoService {
  constructor(private readonly db = prisma) {}

  /**
   * Tudo acontece em UMA transação: as vendas são validadas e apenas aquelas onde 100%
   * dos produtos e insumos foram reconhecidos são "reivindicadas" (processado=true).
   * Vendas com produtos pendentes ou sem itens válidos NUNCA são marcadas como processadas,
   * permanecendo pendentes no banco com alertas para que o operador resolva no catálogo.
   *
   * Duas execuções simultâneas não descontam em dobro: a segunda espera o commit da primeira,
   * enxerga a mudança de versão/estado e aborta ou repete sem efeito colateral.
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

        // Separa por intenção do evento Anota AI
        const aAbater = pendentes.filter((v) => classificarVenda(v.payloadOriginal) === 'abater');
        const aIgnorar = pendentes.filter((v) => classificarVenda(v.payloadOriginal) === 'ignorar');
        const aguardandoEstado = pendentes.length - aAbater.length - aIgnorar.length;

        // Carrega catálogo de produtos e indexa por chave canônica normalizada
        const produtos = await tx.produto.findMany({
          include: { fichasTecnicas: { include: { insumo: true } } },
        });
        const produtoPorNome = new Map(produtos.map((p) => [normalizarNomeProduto(p.nome), p]));

        const descontosPorInsumo = new Map<string, number>();
        const naoEncontrados = new Set<string>();
        const vendasProntasParaAbater: typeof aAbater = [];
        let vendasSemItens = 0;
        let vendasPendentesNaoMapeadas = 0;

        // Flatten helper para extrair itens e subItems com quantidade multiplicada
        const expandirItens = (lista: ItemVenda[], multiplicadorPai = 1): Array<{ nome: string; quantidade: number }> => {
          const resultado: Array<{ nome: string; quantidade: number }> = [];
          for (const item of lista) {
            const qtdEfetiva = item.quantidade * multiplicadorPai;
            resultado.push({ nome: item.nome, quantidade: qtdEfetiva });
            if (item.subItens && item.subItens.length > 0) {
              resultado.push(...expandirItens(item.subItens, qtdEfetiva));
            }
          }
          return resultado;
        };

        for (const venda of aAbater) {
          const itensBrutos = extrairItens(venda.payloadOriginal);
          if (itensBrutos.length === 0) {
            // Venda sem itens válidos não pode ser abatida: fica pendente para conferência
            vendasSemItens++;
            continue;
          }

          const itensExpandidos = expandirItens(itensBrutos);
          let todosMapeados = true;
          const itensDaVendaComProduto: Array<{
            produto: (typeof produtos)[number];
            quantidade: number;
          }> = [];

          for (const item of itensExpandidos) {
            const chave = normalizarNomeProduto(item.nome);
            const produto = produtoPorNome.get(chave);
            if (!produto) {
              todosMapeados = false;
              naoEncontrados.add(item.nome);
            } else {
              itensDaVendaComProduto.push({ produto, quantidade: item.quantidade });
            }
          }

          if (!todosMapeados) {
            // NUNCA baixa parcialmente nem marca como processada venda que possui itens desconhecidos.
            // Ela continua pendente para ser consolidada assim que o produto for cadastrado.
            vendasPendentesNaoMapeadas++;
            continue;
          }

          // Todos os produtos da venda foram encontrados: acumula os insumos desta venda
          for (const { produto, quantidade } of itensDaVendaComProduto) {
            for (const ficha of produto.fichasTecnicas) {
              const fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0);
              const desconto = ficha.quantidade * (1 + fatorPerda) * quantidade;
              descontosPorInsumo.set(ficha.insumoId, (descontosPorInsumo.get(ficha.insumoId) ?? 0) + desconto);
            }
          }

          vendasProntasParaAbater.push(venda);
        }

        const aReivindicar = [...vendasProntasParaAbater, ...aIgnorar];
        const totalAguardando = aguardandoEstado + vendasSemItens + vendasPendentesNaoMapeadas;

        if (aReivindicar.length === 0) {
          return {
            consolidadas: 0,
            vendasAguardando: totalAguardando,
            vendasSemItens: vendasSemItens > 0 ? vendasSemItens : undefined,
            vendasPendentesNaoMapeadas: vendasPendentesNaoMapeadas > 0 ? vendasPendentesNaoMapeadas : undefined,
            produtosNaoEncontrados: naoEncontrados.size > 0 ? [...naoEncontrados] : undefined,
            mensagem: 'Nenhuma venda pronta para consolidar.',
          };
        }

        // Reivindica apenas as vendas que de fato foram concluídas (abater com 100% dos produtos ou ignorar)
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

        // Aplica o decremento de insumos no banco com arredondamento seguro de 4 casas
        const negativos: NonNullable<ResultadoConsolidacao['insumosComEstoqueNegativo']> = [];
        for (const [insumoId, quantidade] of descontosPorInsumo) {
          const quantidadeArredondada = Number(quantidade.toFixed(4));
          const atualizado = await tx.insumo.update({
            where: { id: insumoId },
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
          insumosAfetados: descontosPorInsumo.size,
          vendasSemItens: vendasSemItens > 0 ? vendasSemItens : undefined,
          canceladasIgnoradas: aIgnorar.length > 0 ? aIgnorar.length : undefined,
          vendasAguardando: totalAguardando > 0 ? totalAguardando : undefined,
          vendasPendentesNaoMapeadas: vendasPendentesNaoMapeadas > 0 ? vendasPendentesNaoMapeadas : undefined,
          produtosNaoEncontrados: naoEncontrados.size > 0 ? [...naoEncontrados] : undefined,
          insumosComEstoqueNegativo: negativos.length > 0 ? negativos : undefined,
        };
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}
