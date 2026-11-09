export interface ItemSubFichaFixture {
  id: string;
  insumoBeneficiadoId: string;
  insumoBrutoId: string;
  quantidadeNecessaria: number;
  insumoBruto: {
    id: string;
    nome: string;
    unidade: string;
    estoqueAtual: number;
    fatorPerda: number;
    custoUnitario?: number;
  };
}

export interface RespostaProduzirFixture {
  insumo: {
    id: string;
    nome: string;
    estoqueAtual: number;
  };
  quantidadeProduzida: number;
  validadeEm: string | null;
  consumos: {
    insumoBrutoId: string;
    nome: string;
    consumo: number;
  }[];
}

export const mockItemSubFichaOleo: ItemSubFichaFixture = {
  id: 'subf-001',
  insumoBeneficiadoId: 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
  insumoBrutoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
  quantidadeNecessaria: 0.64,
  insumoBruto: {
    id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
    nome: 'Óleo de Soja',
    unidade: 'Mililitros',
    estoqueAtual: 5000,
    fatorPerda: 0.02,
    custoUnitario: 0.008,
  },
};

export const mockListaSubFicha: ItemSubFichaFixture[] = [
  mockItemSubFichaOleo,
];

export const mockRespostaProduzir: RespostaProduzirFixture = {
  insumo: {
    id: 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
    nome: 'Maionese da Casa',
    estoqueAtual: 4000,
  },
  quantidadeProduzida: 1500,
  validadeEm: '2026-10-20T16:00:00.000Z',
  consumos: [
    {
      insumoBrutoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
      nome: 'Óleo de Soja',
      consumo: 980,
    },
  ],
};

export const mockErroEstoqueInsuficientePreparo = {
  message: 'Estoque insuficiente do insumo bruto "Óleo de Soja". Necessário: 980, Disponível: 500',
};
