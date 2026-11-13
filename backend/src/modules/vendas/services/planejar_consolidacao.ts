import { AnotaAIAdapter, normalizarNomeProduto } from './anotaai.adapter.js';
import type { ItemVenda } from './anotaai.adapter.js';
import { expandirItens } from './extrair_itens.js';

export interface InsumoDaFicha {
  id: string;
  nome: string;
  unidade: string;
  fatorPerda: number;
  estoqueAtual: number;
}

export interface FichaTecnicaComInsumo {
  insumoId: string;
  quantidade: number;
  insumo: InsumoDaFicha;
}

export interface ProdutoComFichas {
  id: string;
  nome: string;
  fichasTecnicas: FichaTecnicaComInsumo[];
}

export interface VendaParaConsolidar {
  id: string;
  atualizadoEm: Date;
  payloadOriginal: unknown;
}

export interface DescontoInsumo {
  insumoId: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  desconto: number;
}

export type MotivoRetencaoTipo =
  | 'PRODUTO_NAO_ENCONTRADO'
  | 'PRODUTO_SEM_FICHA'
  | 'ITEM_INVALIDO'
  | 'COLISAO_NOME'
  | 'SEM_ITENS';

export interface MotivoRetencaoItem {
  tipo: MotivoRetencaoTipo;
  detalhe: string;
}

export interface PlanoConsolidacao {
  vendasAAbater: VendaParaConsolidar[];
  vendasAIgnorar: VendaParaConsolidar[];
  vendasAguardando: VendaParaConsolidar[];
  vendasSemItens: VendaParaConsolidar[];
  vendasComItensInvalidos: VendaParaConsolidar[];
  vendasComProdutosNaoEncontrados: VendaParaConsolidar[];
  vendasComProdutosSemFicha: VendaParaConsolidar[];
  vendasComColisaoNome: VendaParaConsolidar[];

  vendasPendentesNaoMapeadas: number;

  produtosNaoEncontrados: string[];
  produtosSemFicha: string[];
  produtosComColisaoNome: string[];
  itensInvalidos: Array<{ vendaId: string; itemBruto: unknown; motivo: string }>;
  motivosPorVenda: Map<string, MotivoRetencaoItem[]>;
  checksPorVenda: Map<string, number | null>;

  descontosPorInsumo: Map<string, DescontoInsumo>;
}

function registrarMotivo(
  mapa: Map<string, MotivoRetencaoItem[]>,
  vendaId: string,
  tipo: MotivoRetencaoTipo,
  detalhe: string,
) {
  const lista = mapa.get(vendaId) ?? [];
  if (!lista.some((m) => m.tipo === tipo && m.detalhe === detalhe)) {
    lista.push({ tipo, detalhe });
    mapa.set(vendaId, lista);
  }
}

const adapter = new AnotaAIAdapter();

/**
 * Função pura determinística de planejamento de consolidação de vendas.
 * Compartilhada identicamente entre a execução em banco (ConsolidacaoService)
 * e a simulação offline (scripts/replay-vendas.ts), garantindo consistência total.
 */
export function planejarConsolidacao(
  vendas: VendaParaConsolidar[],
  produtos: ProdutoComFichas[],
): PlanoConsolidacao {
  // 1. Indexação do catálogo e detecção de colisões de nomes normalizados (ex.: "X-Bacon" vs "X Bacon")
  const produtoPorNome = new Map<string, ProdutoComFichas>();
  const nomesComColisao = new Set<string>();

  for (const p of produtos) {
    const chave = normalizarNomeProduto(p.nome);
    if (!chave) continue;
    if (produtoPorNome.has(chave)) {
      nomesComColisao.add(chave);
    } else {
      produtoPorNome.set(chave, p);
    }
  }

  const plano: PlanoConsolidacao = {
    vendasAAbater: [],
    vendasAIgnorar: [],
    vendasAguardando: [],
    vendasSemItens: [],
    vendasComItensInvalidos: [],
    vendasComProdutosNaoEncontrados: [],
    vendasComProdutosSemFicha: [],
    vendasComColisaoNome: [],
    vendasPendentesNaoMapeadas: 0,
    produtosNaoEncontrados: [],
    produtosSemFicha: [],
    produtosComColisaoNome: [],
    itensInvalidos: [],
    motivosPorVenda: new Map(),
    checksPorVenda: new Map(),
    descontosPorInsumo: new Map(),
  };

  const produtosNaoEncontradosSet = new Set<string>();
  const produtosSemFichaSet = new Set<string>();
  const produtosComColisaoNomeSet = new Set<string>();
  const vendasNaoMapeadasIds = new Set<string>();

  for (const venda of vendas) {
    const parse = adapter.parsear(venda.payloadOriginal);
    plano.checksPorVenda.set(venda.id, parse.check);

    if (parse.destino === 'ignorar') {
      plano.vendasAIgnorar.push(venda);
      continue;
    }

    if (parse.destino === 'aguardar') {
      plano.vendasAguardando.push(venda);
      continue;
    }

    // destino: 'abater'
    let vendaElegivel = true;

    // Cenário B: Se a venda tiver itens que não puderam ser lidos (sem quantidade, etc.),
    // ela NUNCA pode ser consumida pela metade!
    if (parse.itensInvalidos.length > 0) {
      vendaElegivel = false;
      plano.vendasComItensInvalidos.push(venda);
      vendasNaoMapeadasIds.add(venda.id);
      for (const inv of parse.itensInvalidos) {
        plano.itensInvalidos.push({ vendaId: venda.id, ...inv });
        registrarMotivo(plano.motivosPorVenda, venda.id, 'ITEM_INVALIDO', inv.motivo);
      }
    }

    if (parse.itens.length === 0) {
      vendaElegivel = false;
      plano.vendasSemItens.push(venda);
      vendasNaoMapeadasIds.add(venda.id);
      registrarMotivo(plano.motivosPorVenda, venda.id, 'SEM_ITENS', 'Pedido sem itens válidos no payload');
    }

    if (!vendaElegivel) {
      continue;
    }

    const itensExpandidos = expandirItens(parse.itens);
    let temColisao = false;
    let temNaoEncontrado = false;
    let temProdutoSemFicha = false;
    const itensValidados: Array<{ produto: ProdutoComFichas; quantidade: number }> = [];

    for (const item of itensExpandidos) {
      const chave = normalizarNomeProduto(item.nome);

      // Cenário D: Colisão de nomes no catálogo (ambiguidade não pode escolher silenciosamente)
      if (nomesComColisao.has(chave)) {
        temColisao = true;
        produtosComColisaoNomeSet.add(item.nome);
        registrarMotivo(plano.motivosPorVenda, venda.id, 'COLISAO_NOME', item.nome);
        continue;
      }

      const produto = produtoPorNome.get(chave);
      if (!produto) {
        temNaoEncontrado = true;
        produtosNaoEncontradosSet.add(item.nome);
        registrarMotivo(plano.motivosPorVenda, venda.id, 'PRODUTO_NAO_ENCONTRADO', item.nome);
        continue;
      }

      // Cenário C: Produto sem ficha técnica não pode ser consumido sem baixar nada
      if (produto.fichasTecnicas.length === 0) {
        temProdutoSemFicha = true;
        produtosSemFichaSet.add(produto.nome);
        registrarMotivo(plano.motivosPorVenda, venda.id, 'PRODUTO_SEM_FICHA', produto.nome);
        continue;
      }

      itensValidados.push({ produto, quantidade: item.quantidade });
    }

    if (temColisao) {
      plano.vendasComColisaoNome.push(venda);
      vendasNaoMapeadasIds.add(venda.id);
    }
    if (temNaoEncontrado) {
      plano.vendasComProdutosNaoEncontrados.push(venda);
      vendasNaoMapeadasIds.add(venda.id);
    }
    if (temProdutoSemFicha) {
      plano.vendasComProdutosSemFicha.push(venda);
      vendasNaoMapeadasIds.add(venda.id);
    }

    // Se houve qualquer inconsistência na venda, ela permanece pendente (zero falhas silenciosas)
    if (temColisao || temNaoEncontrado || temProdutoSemFicha) {
      continue;
    }

    // 100% dos itens da venda estão validados, possuem ficha e não colidem: acumula insumos
    for (const { produto, quantidade } of itensValidados) {
      for (const ficha of produto.fichasTecnicas) {
        const fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0);
        const desconto = ficha.quantidade * (1 + fatorPerda) * quantidade;

        const infoAtual = plano.descontosPorInsumo.get(ficha.insumoId) ?? {
          insumoId: ficha.insumoId,
          nome: ficha.insumo.nome,
          unidade: ficha.insumo.unidade,
          estoqueAtual: ficha.insumo.estoqueAtual,
          desconto: 0,
        };

        infoAtual.desconto += desconto;
        plano.descontosPorInsumo.set(ficha.insumoId, infoAtual);
      }
    }

    plano.vendasAAbater.push(venda);
  }

  plano.vendasPendentesNaoMapeadas = vendasNaoMapeadasIds.size;
  plano.produtosNaoEncontrados = [...produtosNaoEncontradosSet];
  plano.produtosSemFicha = [...produtosSemFichaSet];
  plano.produtosComColisaoNome = [...produtosComColisaoNomeSet];

  return plano;
}
