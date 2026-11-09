export interface ResumoDashboardFixture {
  periodo: {
    tipo: 'hoje' | 'semana' | 'mes' | 'custom';
    dataInicio: string;
    dataFim: string;
  };
  kpis: {
    totalVendasValor: number;
    totalVendasQtd: number;
    totalComprasValor: number;
    totalComprasQtd: number;
    totalPerdasValor: number;
    totalPerdasQtd: number;
    insumosEmAlertaQtd: number;
  };
  perdasPorMotivo: {
    motivo: string;
    label: string;
    valorTotal: number;
    quantidadeTotal: number;
    totalOcorrencias: number;
    percentual: number;
  }[];
  consumoInsumos: {
    insumoId: string;
    nome: string;
    unidade: string;
    quantidadeConsumida: number;
    valorEstimado: number;
  }[];
  itensMaisVendidos: {
    produtoNome: string;
    quantidadeVendida: number;
    valorEstimadoTotal: number;
  }[];
  estoqueAlerta: {
    id: string;
    nome: string;
    unidade: string;
    estoqueAtual: number;
    estoqueMinimo: number;
    status: 'CRITICO' | 'ALERTA';
    percentualEstoque: number;
  }[];
  comprasPorFornecedor: {
    fornecedorNome: string;
    fornecedorCnpj: string;
    valorTotal: number;
    totalNotas: number;
    percentual: number;
  }[];
}

export const mockResumoDashboard: ResumoDashboardFixture = {
  periodo: {
    tipo: 'mes',
    dataInicio: '2026-10-01T00:00:00.000Z',
    dataFim: '2026-10-14T23:59:59.999Z',
  },
  kpis: {
    totalVendasValor: 12450.0,
    totalVendasQtd: 312,
    totalComprasValor: 4200.0,
    totalComprasQtd: 8,
    totalPerdasValor: 185.5,
    totalPerdasQtd: 14,
    insumosEmAlertaQtd: 3,
  },
  perdasPorMotivo: [
    {
      motivo: 'VENCIMENTO',
      label: 'Vencimento',
      valorTotal: 98.0,
      quantidadeTotal: 4.5,
      totalOcorrencias: 5,
      percentual: 52.8,
    },
    {
      motivo: 'ERRO_PREPARO',
      label: 'Erro de Preparo',
      valorTotal: 52.5,
      quantidadeTotal: 3.0,
      totalOcorrencias: 6,
      percentual: 28.3,
    },
  ],
  consumoInsumos: [
    {
      insumoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
      nome: 'Carne de Hambúrguer',
      unidade: 'Gramas',
      quantidadeConsumida: 48000,
      valorEstimado: 2400.0,
    },
  ],
  itensMaisVendidos: [
    {
      produtoNome: 'BACON HOUSE',
      quantidadeVendida: 142,
      valorEstimadoTotal: 4970.0,
    },
  ],
  estoqueAlerta: [
    {
      id: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
      nome: 'Pão Brioche',
      unidade: 'Unidade',
      estoqueAtual: 15,
      estoqueMinimo: 50,
      status: 'CRITICO',
      percentualEstoque: 30.0,
    },
  ],
  comprasPorFornecedor: [
    {
      fornecedorNome: 'DISTRIBUIDORA DE ALIMENTOS MS LTDA',
      fornecedorCnpj: '12345678000199',
      valorTotal: 2800.0,
      totalNotas: 4,
      percentual: 66.7,
    },
  ],
};

export const mockErroPeriodoInvalido = {
  message: 'Data de início não pode ser posterior à data de fim',
};

export const mockErroPeriodoExcede366Dias = {
  message: 'O período selecionado não pode exceder 366 dias',
};
