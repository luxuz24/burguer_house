import { DashboardRepository } from '../repositories/dashboard.repository.js';
import { AnotaAIAdapter } from '../../vendas/services/anotaai.adapter.js';
import { expandirItens, normalizarNomeProduto } from '../../vendas/services/extrair_itens.js';
import {
  obterAnoEMesLoja,
  obterIntervaloDiaLoja,
  obterIntervaloSemanaLoja,
  obterIntervaloMesLoja,
  parsearDiaLoja,
} from '../../../shared/datas.js';

export interface FiltroPeriodo {
  periodo?: 'hoje' | 'semana' | 'mes' | undefined;
  dataInicio?: string | undefined;
  dataFim?: string | undefined;
}

export interface KpisDashboard {
  totalVendasValor: number;
  totalVendasQtd: number;
  totalComprasValor: number;
  totalComprasQtd: number;
  totalPerdasValor: number;
  totalPerdasQtd: number;
  insumosEmAlertaQtd: number;
}

export interface PerdaPorMotivoItem {
  motivo: string;
  label: string;
  valorTotal: number;
  quantidadeTotal: number;
  totalOcorrencias: number;
  percentual: number;
}

export interface ConsumoInsumoItem {
  insumoId: string;
  nome: string;
  unidade: string;
  quantidadeConsumida: number;
  valorEstimado: number;
}

export interface ItemMaisVendido {
  produtoNome: string;
  quantidadeVendida: number;
  valorEstimadoTotal: number;
}

export interface EstoqueAlertaItem {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  status: 'CRITICO' | 'ALERTA';
  percentualEstoque: number;
  diasRestantesValidade?: number | undefined;
  vencido?: boolean | undefined;
}

function avaliarValidadeInsumo(insumo: {
  produzidoInternamente?: boolean | undefined;
  validadeDias?: number | null | undefined;
  atualizadoEm?: Date | string | undefined;
  estoqueAtual: number;
}) {
  if (!insumo.produzidoInternamente || !insumo.validadeDias || !insumo.atualizadoEm || insumo.estoqueAtual <= 0) {
    return null;
  }
  const atualizadoMs = new Date(insumo.atualizadoEm).getTime();
  if (isNaN(atualizadoMs)) return null;
  const expiraEm = atualizadoMs + insumo.validadeDias * 86_400_000;
  const diasRestantes = Math.ceil((expiraEm - Date.now()) / 86_400_000);
  return {
    diasRestantes,
    vencido: diasRestantes <= 0,
    alerta: diasRestantes > 0 && diasRestantes <= 2,
  };
}

export interface ComprasPorFornecedorItem {
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  totalNotas: number;
  percentual: number;
}

export interface ResumoDashboard {
  periodo: {
    tipo: string;
    dataInicio: string;
    dataFim: string;
  };
  kpis: KpisDashboard;
  perdasPorMotivo: PerdaPorMotivoItem[];
  consumoInsumos: ConsumoInsumoItem[];
  itensMaisVendidos: ItemMaisVendido[];
  estoqueAlerta: EstoqueAlertaItem[];
  comprasPorFornecedor: ComprasPorFornecedorItem[];
}

export const MAX_DIAS_PERIODO_DASHBOARD = 366;

export class PeriodoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodoInvalidoError';
  }
}

export class DashboardService {
  private repository: DashboardRepository;
  private adapter: AnotaAIAdapter;

  constructor(repository?: DashboardRepository, adapter?: AnotaAIAdapter) {
    this.repository = repository || new DashboardRepository();
    this.adapter = adapter || new AnotaAIAdapter();
  }

  calcularDatasPeriodo(
    filtro: FiltroPeriodo,
    agora: Date = new Date(),
  ): { dataInicio: Date; dataFim: Date; tipo: string } {
    if (filtro.dataInicio !== undefined || filtro.dataFim !== undefined) {
      if (!filtro.dataInicio || !filtro.dataFim) {
        throw new PeriodoInvalidoError('Informe tanto dataInicio quanto dataFim para filtro personalizado');
      }

      let inicio: Date;
      let fim: Date;

      const inicioParsed = parsearDiaLoja(filtro.dataInicio, 'inicio');
      if (inicioParsed) {
        inicio = inicioParsed;
      } else if (typeof filtro.dataInicio === 'string' && /^\s*\d{4}-\d{2}-\d{2}\s*$/.test(filtro.dataInicio)) {
        throw new PeriodoInvalidoError('Datas de filtro personalizado inválidas');
      } else {
        inicio = new Date(filtro.dataInicio);
      }

      const fimParsed = parsearDiaLoja(filtro.dataFim, 'fim');
      if (fimParsed) {
        fim = fimParsed;
      } else if (typeof filtro.dataFim === 'string' && /^\s*\d{4}-\d{2}-\d{2}\s*$/.test(filtro.dataFim)) {
        throw new PeriodoInvalidoError('Datas de filtro personalizado inválidas');
      } else {
        fim = new Date(filtro.dataFim);
      }

      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        throw new PeriodoInvalidoError('Datas de filtro personalizado inválidas');
      }
      if (inicio.getTime() > fim.getTime()) {
        throw new PeriodoInvalidoError('A dataInicio não pode ser posterior à dataFim');
      }
      const diasIntervalo = (fim.getTime() - inicio.getTime()) / 86_400_000;
      if (diasIntervalo > MAX_DIAS_PERIODO_DASHBOARD) {
        throw new PeriodoInvalidoError(
          `O intervalo máximo permitido para consulta no dashboard é de ${MAX_DIAS_PERIODO_DASHBOARD} dias`,
        );
      }
      return { dataInicio: inicio, dataFim: fim, tipo: 'personalizado' };
    }

    if (filtro.periodo === 'hoje') {
      const { inicio, fim } = obterIntervaloDiaLoja(agora);
      return { dataInicio: inicio, dataFim: fim, tipo: 'hoje' };
    }

    if (filtro.periodo === 'semana') {
      const { inicio, fim } = obterIntervaloSemanaLoja(agora);
      return { dataInicio: inicio, dataFim: fim, tipo: 'semana' };
    }

    // Default: 'mes' (mês corrente no fuso da loja America/Campo_Grande)
    const { ano, mes } = obterAnoEMesLoja(agora);
    const { inicio: inicioMes } = obterIntervaloMesLoja(ano, mes);
    const { fim: fimHoje } = obterIntervaloDiaLoja(agora);
    return { dataInicio: inicioMes, dataFim: fimHoje, tipo: 'mes' };
  }

  async obterResumo(filtro: FiltroPeriodo = {}, agora?: Date): Promise<ResumoDashboard> {
    const { dataInicio, dataFim, tipo } = this.calcularDatasPeriodo(filtro, agora);

    const [perdas, vendas, notasFiscais, todosInsumos, produtosComFichas] = await Promise.all([
      this.repository.buscarPerdasPorPeriodo(dataInicio, dataFim),
      this.repository.buscarVendasProcessadasPorPeriodo(dataInicio, dataFim),
      this.repository.buscarNotasFiscaisPorPeriodo(dataInicio, dataFim),
      this.repository.buscarInsumos(),
      this.repository.buscarProdutosComFichas(),
    ]);

    // 1. Agregação de Perdas por Motivo
    const mapaMotivos: Record<string, { label: string; valorTotal: number; quantidadeTotal: number; totalOcorrencias: number }> = {
      VENCIMENTO: { label: 'Vencimento', valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 },
      ERRO_PREPARO: { label: 'Erro de Preparo', valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 },
      ESTRAGADO: { label: 'Estragado', valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 },
      OUTRO: { label: 'Outro', valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 },
    };

    let totalPerdasValor = 0;
    let totalPerdasOcorrencias = 0;
    for (const perda of perdas) {
      const custoUnitario =
        perda.custoUnitario !== undefined && perda.custoUnitario !== null
          ? perda.custoUnitario
          : (perda.insumo?.custoUnitario || 0);
      const custo = custoUnitario * perda.quantidade;
      totalPerdasValor += custo;
      totalPerdasOcorrencias += 1;

      let itemMotivo = mapaMotivos[perda.motivo];
      if (!itemMotivo) {
        itemMotivo = { label: perda.motivo, valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 };
        mapaMotivos[perda.motivo] = itemMotivo;
      }
      itemMotivo.valorTotal += custo;
      itemMotivo.quantidadeTotal += perda.quantidade;
      itemMotivo.totalOcorrencias += 1;
    }

    const perdasPorMotivo: PerdaPorMotivoItem[] = Object.entries(mapaMotivos)
      .filter(([, dados]) => dados.totalOcorrencias > 0)
      .map(([motivo, dados]) => ({
        motivo,
        label: dados.label,
        valorTotal: Number(dados.valorTotal.toFixed(2)),
        quantidadeTotal: Number(dados.quantidadeTotal.toFixed(2)),
        totalOcorrencias: dados.totalOcorrencias,
        percentual: totalPerdasValor > 0
          ? Number(((dados.valorTotal / totalPerdasValor) * 100).toFixed(1))
          : totalPerdasOcorrencias > 0
          ? Number(((dados.totalOcorrencias / totalPerdasOcorrencias) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => (b.valorTotal - a.valorTotal) || (b.totalOcorrencias - a.totalOcorrencias));

    // 2. Agregação de Vendas, Itens Mais Vendidos e Consumo de Insumos (com lookup normalizado O(1) e detecção de colisão)
    const produtoPorNome = new Map<string, (typeof produtosComFichas)[0]>();
    const nomesComColisao = new Set<string>();

    for (const p of produtosComFichas) {
      const chave = normalizarNomeProduto(p.nome);
      if (!chave) continue;
      if (produtoPorNome.has(chave)) {
        nomesComColisao.add(chave);
      } else {
        produtoPorNome.set(chave, p);
      }
    }

    const mapaProdutosVendidos = new Map<string, { nomeExibicao: string; quantidade: number; valorTotal: number }>();
    const mapaInsumosConsumidos: Record<string, { nome: string; unidade: string; quantidade: number; valorEstimado: number }> = {};
    let totalVendasValor = 0;
    let totalVendasQtd = 0;

    for (const venda of vendas) {
      const parse = this.adapter.parsear(venda.payloadOriginal);

      // Apenas vendas confirmadas/aceitas ('abater') entram no faturamento, itens mais vendidos e consumo.
      // Pedidos cancelados ('ignorar') e pedidos pendentes/agendados ('aguardar') são desconsiderados.
      if (parse.destino !== 'abater') continue;
      if (parse.itens.length === 0) continue;

      totalVendasQtd += 1;

      // Expande modificadores/adicionais recursivamente, mantendo paridade estrita com a consolidação de estoque
      const itens = expandirItens(parse.itens);

      for (const { nome, quantidade: qtd, preco } of itens) {
        const subtotal = preco > 0 ? preco * qtd : 0;
        totalVendasValor += subtotal;

        // Normalização canônica para unificar o mesmo produto grafado de formas diferentes ("X-Bacon" vs "X Bacon")
        const chave = normalizarNomeProduto(nome) || nome.trim().toLowerCase();
        const produto = !nomesComColisao.has(chave) ? produtoPorNome.get(chave) : undefined;

        let prodVendido = mapaProdutosVendidos.get(chave);
        if (!prodVendido) {
          const nomeExibicao = produto?.nome ?? nome.trim();
          prodVendido = { nomeExibicao, quantidade: 0, valorTotal: 0 };
          mapaProdutosVendidos.set(chave, prodVendido);
        } else if (produto && prodVendido.nomeExibicao !== produto.nome) {
          // Garante que o nome canônico do catálogo prevaleça sobre variações do pedido
          prodVendido.nomeExibicao = produto.nome;
        }
        prodVendido.quantidade += qtd;
        prodVendido.valorTotal += subtotal;

        // Abatimento em insumos pelas fichas técnicas usando normalização canônica
        if (nomesComColisao.has(chave)) {
          // Em caso de colisão de nomes no cardápio, não deduz estoque de produto ambíguo
          continue;
        }

        const produtoConsumo = produtoPorNome.get(chave);

        if (produtoConsumo) {
          for (const ficha of produtoConsumo.fichasTecnicas) {
            const fatorPerda = Math.max(0, ficha.insumo?.fatorPerda || 0);
            const qtdInsumoConsumido = ficha.quantidade * (1 + fatorPerda) * qtd;
            const custoUnit = ficha.insumo?.custoUnitario || 0;

            let insumoConsumido = mapaInsumosConsumidos[ficha.insumoId];
            if (!insumoConsumido) {
              insumoConsumido = {
                nome: ficha.insumo.nome,
                unidade: ficha.insumo.unidade,
                quantidade: 0,
                valorEstimado: 0,
              };
              mapaInsumosConsumidos[ficha.insumoId] = insumoConsumido;
            }
            insumoConsumido.quantidade += qtdInsumoConsumido;
            insumoConsumido.valorEstimado += qtdInsumoConsumido * custoUnit;
          }
        }
      }
    }

    const itensMaisVendidos: ItemMaisVendido[] = Array.from(mapaProdutosVendidos.values())
      .map((dados) => ({
        produtoNome: dados.nomeExibicao,
        quantidadeVendida: dados.quantidade,
        valorEstimadoTotal: Number(dados.valorTotal.toFixed(2)),
      }))
      .sort((a, b) => (b.quantidadeVendida - a.quantidadeVendida) || (b.valorEstimadoTotal - a.valorEstimadoTotal))
      .slice(0, 10);

    const consumoInsumos: ConsumoInsumoItem[] = Object.entries(mapaInsumosConsumidos)
      .map(([insumoId, dados]) => ({
        insumoId,
        nome: dados.nome,
        unidade: dados.unidade,
        quantidadeConsumida: Number(dados.quantidade.toFixed(2)),
        valorEstimado: Number(dados.valorEstimado.toFixed(2)),
      }))
      .sort((a, b) => b.quantidadeConsumida - a.quantidadeConsumida)
      .slice(0, 10);

    // 3. Estoque Atual vs Mínimo e Validade de Beneficiados
    const estoqueAlerta: EstoqueAlertaItem[] = todosInsumos
      .filter((insumo) => {
        const val = avaliarValidadeInsumo(insumo);
        return insumo.estoqueAtual <= insumo.estoqueMinimo * 1.25 || (val !== null && (val.vencido || val.alerta));
      })
      .map((insumo) => {
        const val = avaliarValidadeInsumo(insumo);
        const isCritico = insumo.estoqueAtual <= insumo.estoqueMinimo || Boolean(val?.vencido);
        const status: 'CRITICO' | 'ALERTA' = isCritico ? 'CRITICO' : 'ALERTA';
        const percentualEstoque = insumo.estoqueMinimo > 0
          ? Number(((insumo.estoqueAtual / insumo.estoqueMinimo) * 100).toFixed(1))
          : 100;

        return {
          id: insumo.id,
          nome: insumo.nome,
          unidade: insumo.unidade,
          estoqueAtual: insumo.estoqueAtual,
          estoqueMinimo: insumo.estoqueMinimo,
          status,
          percentualEstoque,
          ...(val && (val.vencido || val.alerta)
            ? { diasRestantesValidade: val.diasRestantes, vencido: val.vencido }
            : {}),
        };
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'CRITICO' ? -1 : 1;
        return a.percentualEstoque - b.percentualEstoque;
      });

    // 4. Custo de Compras por Fornecedor (Notas Fiscais)
    const mapaFornecedores: Record<string, { nome: string; cnpj: string; valorTotal: number; totalNotas: number }> = {};
    let totalComprasValor = 0;

    for (const nota of notasFiscais) {
      totalComprasValor += nota.valorTotal;
      const chave = nota.fornecedorCnpj || nota.fornecedorNome;

      if (!mapaFornecedores[chave]) {
        mapaFornecedores[chave] = {
          nome: nota.fornecedorNome,
          cnpj: nota.fornecedorCnpj,
          valorTotal: 0,
          totalNotas: 0,
        };
      }
      mapaFornecedores[chave].valorTotal += nota.valorTotal;
      mapaFornecedores[chave].totalNotas += 1;
    }

    const comprasPorFornecedor: ComprasPorFornecedorItem[] = Object.values(mapaFornecedores)
      .map((forn) => ({
        fornecedorNome: forn.nome,
        fornecedorCnpj: forn.cnpj,
        valorTotal: Number(forn.valorTotal.toFixed(2)),
        totalNotas: forn.totalNotas,
        percentual: totalComprasValor > 0 ? Number(((forn.valorTotal / totalComprasValor) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal);

    // KPIs consolidados
    const kpis: KpisDashboard = {
      totalVendasValor: Number(totalVendasValor.toFixed(2)),
      totalVendasQtd,
      totalComprasValor: Number(totalComprasValor.toFixed(2)),
      totalComprasQtd: notasFiscais.length,
      totalPerdasValor: Number(totalPerdasValor.toFixed(2)),
      totalPerdasQtd: perdas.length,
      insumosEmAlertaQtd: todosInsumos.filter((i) => {
        const val = avaliarValidadeInsumo(i);
        return i.estoqueAtual <= i.estoqueMinimo || (val !== null && (val.vencido || val.alerta));
      }).length,
    };

    return {
      periodo: {
        tipo,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      },
      kpis,
      perdasPorMotivo,
      consumoInsumos,
      itensMaisVendidos,
      estoqueAlerta,
      comprasPorFornecedor,
    };
  }
}
