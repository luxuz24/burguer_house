export interface PerdaFixture {
  id: string;
  insumoId: string;
  quantidade: number;
  motivo: 'VENCIMENTO' | 'ERRO_PREPARO' | 'ESTRAGADO' | 'OUTRO';
  criadoEm: string;
  insumo?: {
    id: string;
    nome: string;
    unidade: string;
    custoUnitario?: number;
  };
}

export interface ResumoMensalPerdasFixture {
  ano: number;
  mes: number;
  porMotivo: {
    motivo: string;
    ocorrencias: number;
    valorTotal: number;
    perdasSemCusto: number;
  }[];
}

export const mockPerdaEstragado: PerdaFixture = {
  id: 'perda-001',
  insumoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
  quantidade: 300,
  motivo: 'ESTRAGADO',
  criadoEm: '2026-10-05T15:30:00.000Z',
  insumo: {
    id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
    nome: 'Carne de Hambúrguer',
    unidade: 'Gramas',
    custoUnitario: 0.045,
  },
};

export const mockPerdaVencimento: PerdaFixture = {
  id: 'perda-002',
  insumoId: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
  quantidade: 5,
  motivo: 'VENCIMENTO',
  criadoEm: '2026-10-06T11:20:00.000Z',
  insumo: {
    id: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
    nome: 'Pão Brioche',
    unidade: 'Unidade',
    custoUnitario: 2.5,
  },
};

export const mockListaPerdas: PerdaFixture[] = [
  mockPerdaEstragado,
  mockPerdaVencimento,
];

export const mockResumoMensalPerdas: ResumoMensalPerdasFixture = {
  ano: 2026,
  mes: 10,
  porMotivo: [
    {
      motivo: 'ESTRAGADO',
      ocorrencias: 3,
      valorTotal: 35.5,
      perdasSemCusto: 0,
    },
    {
      motivo: 'VENCIMENTO',
      ocorrencias: 2,
      valorTotal: 84.0,
      perdasSemCusto: 1,
    },
  ],
};

export const mockErroPerdaInsumoNaoEncontrado = {
  message: 'Insumo não encontrado',
};
