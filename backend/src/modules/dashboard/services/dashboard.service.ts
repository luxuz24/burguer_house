import { DashboardRepository } from '../repositories/dashboard.repository.js';

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

export class DashboardService {
  private repository: DashboardRepository;

  constructor(repository?: DashboardRepository) {
    this.repository = repository || new DashboardRepository();
  }

  calcularDatasPeriodo(filtro: FiltroPeriodo): { dataInicio: Date; dataFim: Date; tipo: string } {
    const agora = new Date();
    const fimHoje = new Date(agora);
    fimHoje.setHours(23, 59, 59, 999);

    if (filtro.dataInicio && filtro.dataFim) {
      const inicio = new Date(filtro.dataInicio);
      const fim = new Date(filtro.dataFim);
      if (!isNaN(inicio.getTime()) && !isNaN(fim.getTime())) {
        return { dataInicio: inicio, dataFim: fim, tipo: 'personalizado' };
      }
    }

    if (filtro.periodo === 'hoje') {
      const inicioHoje = new Date(agora);
      inicioHoje.setHours(0, 0, 0, 0);
      return { dataInicio: inicioHoje, dataFim: fimHoje, tipo: 'hoje' };
    }

    if (filtro.periodo === 'semana') {
      const inicioSemana = new Date(agora);
      inicioSemana.setDate(agora.getDate() - 7);
      inicioSemana.setHours(0, 0, 0, 0);
      return { dataInicio: inicioSemana, dataFim: fimHoje, tipo: 'semana' };
    }

    // Default: 'mes' (mês corrente)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    return { dataInicio: inicioMes, dataFim: fimHoje, tipo: 'mes' };
  }

  async obterResumo(filtro: FiltroPeriodo = {}): Promise<ResumoDashboard> {
    const { dataInicio, dataFim, tipo } = this.calcularDatasPeriodo(filtro);

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
    for (const perda of perdas) {
      const custo = (perda.insumo?.custoUnitario || 0) * perda.quantidade;
      totalPerdasValor += custo;

      let itemMotivo = mapaMotivos[perda.motivo];
      if (!itemMotivo) {
        itemMotivo = { label: perda.motivo, valorTotal: 0, quantidadeTotal: 0, totalOcorrencias: 0 };
        mapaMotivos[perda.motivo] = itemMotivo;
      }
      itemMotivo.valorTotal += custo;
      itemMotivo.quantidadeTotal += perda.quantidade;
      itemMotivo.totalOcorrencias += 1;
    }

    const perdasPorMotivo: PerdaPorMotivoItem[] = Object.entries(mapaMotivos).map(([motivo, dados]) => ({
      motivo,
      label: dados.label,
      valorTotal: Number(dados.valorTotal.toFixed(2)),
      quantidadeTotal: Number(dados.quantidadeTotal.toFixed(2)),
      totalOcorrencias: dados.totalOcorrencias,
      percentual: totalPerdasValor > 0 ? Number(((dados.valorTotal / totalPerdasValor) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.valorTotal - a.valorTotal);

    // 2. Agregação de Vendas, Itens Mais Vendidos e Consumo de Insumos
    const mapaProdutosVendidos: Record<string, { quantidade: number; valorTotal: number }> = {};
    const mapaInsumosConsumidos: Record<string, { nome: string; unidade: string; quantidade: number; valorEstimado: number }> = {};
    let totalVendasValor = 0;

    for (const venda of vendas) {
      const payload: any = venda.payloadOriginal;
      const items = Array.isArray(payload) ? payload : (payload?.items || payload?.order?.items || []);

      for (const item of items) {
        const nome = String(item.name || item.nome || '').trim();
        const qtd = Number(item.quantity || item.quantidade || 0);
        const preco = Number(item.price || item.preco || item.unitPrice || 0);

        if (!nome || qtd <= 0) continue;

        const subtotal = preco > 0 ? preco * qtd : 0;
        totalVendasValor += subtotal;

        let prodVendido = mapaProdutosVendidos[nome];
        if (!prodVendido) {
          prodVendido = { quantidade: 0, valorTotal: 0 };
          mapaProdutosVendidos[nome] = prodVendido;
        }
        prodVendido.quantidade += qtd;
        prodVendido.valorTotal += subtotal;

        // Abatimento em insumos pelas fichas técnicas
        const produto = produtosComFichas.find(
          (p) => p.nome.toLowerCase() === nome.toLowerCase()
        );

        if (produto) {
          for (const ficha of produto.fichasTecnicas) {
            const fatorPerda = ficha.insumo?.fatorPerda || 0;
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

    const itensMaisVendidos: ItemMaisVendido[] = Object.entries(mapaProdutosVendidos)
      .map(([produtoNome, dados]) => ({
        produtoNome,
        quantidadeVendida: dados.quantidade,
        valorEstimadoTotal: Number(dados.valorTotal.toFixed(2)),
      }))
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
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

    // 3. Estoque Atual vs Mínimo
    const estoqueAlerta: EstoqueAlertaItem[] = todosInsumos
      .filter((insumo) => insumo.estoqueAtual <= insumo.estoqueMinimo * 1.25)
      .map((insumo) => {
        const status: 'CRITICO' | 'ALERTA' = insumo.estoqueAtual <= insumo.estoqueMinimo ? 'CRITICO' : 'ALERTA';
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
        };
      })
      .sort((a, b) => a.percentualEstoque - b.percentualEstoque);

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
      totalVendasQtd: vendas.length,
      totalComprasValor: Number(totalComprasValor.toFixed(2)),
      totalComprasQtd: notasFiscais.length,
      totalPerdasValor: Number(totalPerdasValor.toFixed(2)),
      totalPerdasQtd: perdas.length,
      insumosEmAlertaQtd: todosInsumos.filter((i) => i.estoqueAtual <= i.estoqueMinimo).length,
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
