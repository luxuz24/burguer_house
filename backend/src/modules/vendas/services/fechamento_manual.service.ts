import type { CategoriaInsumo } from '../../../../generated/prisma/client.js';
import { prisma } from '../../../infra/database/prisma.js';
import {
  criarDataLoja,
  obterIntervaloDiaLoja,
  obterPartesDataLoja,
  parsearDiaLoja,
} from '../../../shared/datas.js';
import {
  planejarConsolidacao,
  type ProdutoComFichas,
  type VendaParaConsolidar,
} from './planejar_consolidacao.js';

export interface ItemFechamentoInput {
  produtoId: string;
  quantidade: number;
}

export interface SimulacaoFechamentoInput {
  data?: string | undefined;
  itens: ItemFechamentoInput[];
}

export interface ConfirmarFechamentoInput {
  chaveIdempotencia: string;
  data?: string | undefined;
  observacao?: string | undefined;
  itens: ItemFechamentoInput[];
  usuarioId: string | null;
}

export interface ProdutoSemFichaItem {
  produtoId: string;
  nome: string;
}

export interface DetalhesErroFechamento {
  produtosNaoEncontrados: string[];
  produtosSemFicha: ProdutoSemFichaItem[];
}

export interface ConsumoSimulacaoItem {
  insumoId: string;
  nome: string;
  unidade: string;
  categoria: CategoriaInsumo;
  consumo: number;
  estoqueAtual: number;
  estoqueProjetado: number;
  ficariaNegativo: boolean;
}

export interface ResultadoSimulacaoFechamento {
  data: string;
  itens: Array<{ produtoId: string; nome: string; quantidade: number }>;
  consumos: ConsumoSimulacaoItem[];
  produtosSemFicha: ProdutoSemFichaItem[];
  temNegativo: boolean;
  podeConfirmar: boolean;
}

export interface ResultadoConfirmacaoFechamento {
  reaproveitado: boolean;
  vendaId: string;
  externalId: string;
  chaveIdempotencia: string;
  data: string;
  ocorridoEm: string;
  itens: Array<{ produtoId: string; nome: string; quantidade: number }>;
  consumos: Array<{ insumoId: string; nome: string; unidade: string; quantidade: number }>;
  insumosComEstoqueNegativo: Array<{ id: string; nome: string; estoqueAtual: number }>;
}

export class FechamentoManualError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detalhes?: DetalhesErroFechamento,
  ) {
    super(message);
    this.name = 'FechamentoManualError';
  }
}

type PayloadFechamento = {
  info: {
    id: string;
    check: number;
    items: Array<{ produtoId: string; name: string; quantity: number }>;
  };
  origem: 'manual';
  data: string;
  observacao: string | null;
  _fechamento: {
    consumos: Array<{ insumoId: string; nome: string; unidade: string; quantidade: number }>;
    insumosComEstoqueNegativo: Array<{ id: string; nome: string; estoqueAtual: number }>;
  };
};

function normalizarObservacao(observacao?: string | null): string | null {
  const texto = observacao?.trim();
  return texto ? texto : null;
}

function resolverDataFechamento(dataTexto?: string): { data: string; ocorridoEm: Date } {
  const partesHoje = obterPartesDataLoja(new Date());
  const dataStr = dataTexto?.trim()
    ? dataTexto.trim()
    : `${partesHoje.ano}-${String(partesHoje.mes).padStart(2, '0')}-${String(partesHoje.dia).padStart(2, '0')}`;

  const fimDia = parsearDiaLoja(dataStr, 'fim');
  if (!fimDia) {
    throw new FechamentoManualError('Data inválida; use o formato AAAA-MM-DD', 400);
  }

  const { fim: fimHojeLoja } = obterIntervaloDiaLoja(new Date());
  if (fimDia.getTime() > fimHojeLoja.getTime()) {
    throw new FechamentoManualError('A data não pode ser futura', 400);
  }

  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const ocorridoEm = criarDataLoja(ano!, mes!, dia!, 12, 0, 0, 0);
  return { data: dataStr, ocorridoEm };
}

function agruparItensPorProduto(itens: ItemFechamentoInput[]): ItemFechamentoInput[] {
  const mapa = new Map<string, number>();
  for (const item of itens) {
    mapa.set(item.produtoId, (mapa.get(item.produtoId) ?? 0) + item.quantidade);
  }
  return Array.from(mapa.entries()).map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

export class FechamentoManualService {
  constructor(private readonly db = prisma) {}

  private async carregarProdutosValidados(
    dbClient: Pick<typeof prisma, 'produto'>,
    itensAgrupados: ItemFechamentoInput[],
  ) {
    const ids = itensAgrupados.map((it) => it.produtoId);
    const produtos = await dbClient.produto.findMany({
      where: { id: { in: ids } },
      include: { fichasTecnicas: { include: { insumo: true } } },
    });

    const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));
    const produtosNaoEncontrados = ids.filter((id) => !mapaProdutos.has(id));
    if (produtosNaoEncontrados.length > 0) {
      throw new FechamentoManualError(
        'Um ou mais produtos informados não foram encontrados',
        422,
        { produtosNaoEncontrados, produtosSemFicha: [] },
      );
    }

    const itensComProduto = itensAgrupados.map((it) => {
      const produto = mapaProdutos.get(it.produtoId)!;
      return { produtoId: produto.id, nome: produto.nome, quantidade: it.quantidade, produto };
    });

    const categoriaPorInsumo = new Map<string, CategoriaInsumo>();
    for (const p of produtos) {
      for (const f of p.fichasTecnicas) {
        categoriaPorInsumo.set(f.insumoId, f.insumo.categoria);
      }
    }

    return { produtos, itensComProduto, categoriaPorInsumo };
  }

  private planejarPelosItens(
    externalId: string,
    itensComProduto: Array<{ produtoId: string; nome: string; quantidade: number }>,
    produtos: ProdutoComFichas[],
  ) {
    const agora = new Date();
    // Uma venda sintética por item permite que planejarConsolidacao calcule os descontos dos itens
    // válidos na simulação mesmo quando outro item da lista está sem ficha técnica.
    const vendasSinteticas: VendaParaConsolidar[] = itensComProduto.map((it) => ({
      id: it.produtoId,
      atualizadoEm: agora,
      payloadOriginal: {
        info: {
          id: externalId,
          check: 1,
          items: [{ name: it.nome, quantity: it.quantidade }],
        },
      },
    }));

    return planejarConsolidacao(vendasSinteticas, produtos);
  }

  private extrairProdutosSemFicha(
    itensComProduto: Array<{ produtoId: string; nome: string }>,
    nomesSemFicha: string[],
  ): ProdutoSemFichaItem[] {
    if (nomesSemFicha.length === 0) return [];
    const setNomes = new Set(nomesSemFicha);
    return itensComProduto
      .filter((it) => setNomes.has(it.nome))
      .map(({ produtoId, nome }) => ({ produtoId, nome }));
  }

  private construirReplay(
    venda: { id: string; externalId: string | null; ocorridoEm: Date; payloadOriginal: unknown },
    chaveIdempotencia: string,
    dataEsperada: string,
    obsNormalizada: string | null,
    itensAgrupados: ItemFechamentoInput[],
  ): ResultadoConfirmacaoFechamento {
    const payload = venda.payloadOriginal as PayloadFechamento;
    const itensGravadosOrdenados = [...payload.info.items].sort((a, b) =>
      a.produtoId.localeCompare(b.produtoId),
    );
    const itensRequisicaoOrdenados = [...itensAgrupados].sort((a, b) =>
      a.produtoId.localeCompare(b.produtoId),
    );

    const mesmoCorpo =
      payload.data === dataEsperada &&
      payload.observacao === obsNormalizada &&
      itensGravadosOrdenados.length === itensRequisicaoOrdenados.length &&
      itensGravadosOrdenados.every(
        (g, idx) =>
          itensRequisicaoOrdenados[idx]!.produtoId === g.produtoId &&
          itensRequisicaoOrdenados[idx]!.quantidade === g.quantity,
      );

    if (!mesmoCorpo) {
      throw new FechamentoManualError(
        'Já existe um fechamento manual registrado com esta chave de idempotência e conteúdo diferente',
        409,
      );
    }

    const mapaItensGravados = new Map(payload.info.items.map((g) => [g.produtoId, g]));

    return {
      reaproveitado: true,
      vendaId: venda.id,
      externalId: venda.externalId!,
      chaveIdempotencia,
      data: payload.data,
      ocorridoEm: venda.ocorridoEm.toISOString(),
      itens: itensAgrupados.map((i) => ({
        produtoId: i.produtoId,
        nome: mapaItensGravados.get(i.produtoId)!.name,
        quantidade: i.quantidade,
      })),
      consumos: payload._fechamento.consumos,
      insumosComEstoqueNegativo: payload._fechamento.insumosComEstoqueNegativo,
    };
  }

  async simular(input: SimulacaoFechamentoInput): Promise<ResultadoSimulacaoFechamento> {
    if (input.itens.length === 0) {
      throw new FechamentoManualError('Informe ao menos um produto para simular', 400);
    }

    const { data } = resolverDataFechamento(input.data);
    const itensAgrupados = agruparItensPorProduto(input.itens);
    const { produtos, itensComProduto, categoriaPorInsumo } = await this.carregarProdutosValidados(
      this.db,
      itensAgrupados,
    );

    const plano = this.planejarPelosItens('manual:simulacao', itensComProduto, produtos);
    const produtosSemFicha = this.extrairProdutosSemFicha(itensComProduto, plano.produtosSemFicha);

    const consumos: ConsumoSimulacaoItem[] = [];
    for (const [, info] of plano.descontosPorInsumo) {
      const consumo = Number(info.desconto.toFixed(4));
      const estoqueProjetado = Number((info.estoqueAtual - consumo).toFixed(4));
      consumos.push({
        insumoId: info.insumoId,
        nome: info.nome,
        unidade: info.unidade,
        categoria: categoriaPorInsumo.get(info.insumoId) ?? 'INGREDIENTE',
        consumo,
        estoqueAtual: info.estoqueAtual,
        estoqueProjetado,
        ficariaNegativo: estoqueProjetado < 0,
      });
    }

    consumos.sort((a, b) => {
      const aNeg = a.ficariaNegativo ? 0 : 1;
      const bNeg = b.ficariaNegativo ? 0 : 1;
      if (aNeg !== bNeg) return aNeg - bNeg;
      const cmpCat = a.categoria.localeCompare(b.categoria, 'pt-BR');
      if (cmpCat !== 0) return cmpCat;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    return {
      data,
      itens: itensComProduto.map(({ produtoId, nome, quantidade }) => ({
        produtoId,
        nome,
        quantidade,
      })),
      consumos,
      produtosSemFicha,
      temNegativo: consumos.some((c) => c.ficariaNegativo),
      podeConfirmar: produtosSemFicha.length === 0 && plano.produtosComColisaoNome.length === 0,
    };
  }

  async confirmar(input: ConfirmarFechamentoInput): Promise<ResultadoConfirmacaoFechamento> {
    if (input.itens.length === 0) {
      throw new FechamentoManualError('Informe ao menos um produto para confirmar o fechamento', 400);
    }

    const { data, ocorridoEm } = resolverDataFechamento(input.data);
    const obsNormalizada = normalizarObservacao(input.observacao);
    const externalId = `manual:${input.chaveIdempotencia}`;
    const itensAgrupados = agruparItensPorProduto(input.itens);

    try {
      return await this.db.$transaction(
        async (tx) => {
          const existente = await tx.venda.findUnique({ where: { externalId } });
          if (existente) {
            return this.construirReplay(
              existente,
              input.chaveIdempotencia,
              data,
              obsNormalizada,
              itensAgrupados,
            );
          }

          const { produtos, itensComProduto } = await this.carregarProdutosValidados(
            tx,
            itensAgrupados,
          );
          const plano = this.planejarPelosItens(externalId, itensComProduto, produtos);
          const produtosSemFicha = this.extrairProdutosSemFicha(
            itensComProduto,
            plano.produtosSemFicha,
          );

          if (produtosSemFicha.length > 0 || plano.produtosComColisaoNome.length > 0) {
            throw new FechamentoManualError(
              'Não é possível confirmar: existem produtos sem ficha técnica ou com conflito de nome',
              422,
              { produtosNaoEncontrados: [], produtosSemFicha },
            );
          }

          const descontosOrdenados = [...plano.descontosPorInsumo.values()].sort((a, b) =>
            a.insumoId.localeCompare(b.insumoId),
          );

          const consumosResposta: Array<{
            insumoId: string;
            nome: string;
            unidade: string;
            quantidade: number;
          }> = [];
          const insumosComEstoqueNegativo: Array<{
            id: string;
            nome: string;
            estoqueAtual: number;
          }> = [];

          for (const info of descontosOrdenados) {
            const quantidadeArredondada = Number(info.desconto.toFixed(4));
            const atualizado = await tx.insumo.update({
              where: { id: info.insumoId },
              data: { estoqueAtual: { decrement: quantidadeArredondada } },
            });

            consumosResposta.push({
              insumoId: atualizado.id,
              nome: atualizado.nome,
              unidade: atualizado.unidade,
              quantidade: quantidadeArredondada,
            });
            if (atualizado.estoqueAtual < 0) {
              insumosComEstoqueNegativo.push({
                id: atualizado.id,
                nome: atualizado.nome,
                estoqueAtual: atualizado.estoqueAtual,
              });
            }
          }

          const payloadOriginal: PayloadFechamento = {
            info: {
              id: externalId,
              check: 1,
              items: itensComProduto.map((it) => ({
                produtoId: it.produtoId,
                name: it.nome,
                quantity: it.quantidade,
              })),
            },
            origem: 'manual',
            data,
            observacao: obsNormalizada,
            _fechamento: {
              consumos: consumosResposta,
              insumosComEstoqueNegativo,
            },
          };

          const vendaCriada = await tx.venda.create({
            data: {
              externalId,
              origem: 'MANUAL',
              registradoPorId: input.usuarioId,
              ocorridoEm,
              processado: true,
              payloadOriginal,
            },
          });

          return {
            reaproveitado: false,
            vendaId: vendaCriada.id,
            externalId,
            chaveIdempotencia: input.chaveIdempotencia,
            data,
            ocorridoEm: vendaCriada.ocorridoEm.toISOString(),
            itens: itensComProduto.map(({ produtoId, nome, quantidade }) => ({
              produtoId,
              nome,
              quantidade,
            })),
            consumos: consumosResposta,
            insumosComEstoqueNegativo,
          };
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if ((error as { code?: string } | null)?.code === 'P2002') {
        const existente = await this.db.venda.findUnique({ where: { externalId } });
        if (existente) {
          return this.construirReplay(
            existente,
            input.chaveIdempotencia,
            data,
            obsNormalizada,
            itensAgrupados,
          );
        }
      }
      throw error;
    }
  }
}
