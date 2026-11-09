export interface InsumoFixture {
  id: string;
  nome: string;
  unidade: string;
  fatorPerda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  custoUnitario: number;
  produzidoInternamente: boolean;
  validadeDias: number | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const mockInsumoBruto: InsumoFixture = {
  id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
  nome: 'Carne de Hambúrguer',
  unidade: 'Gramas',
  fatorPerda: 0.05,
  estoqueAtual: 5000,
  estoqueMinimo: 1000,
  custoUnitario: 0.045,
  produzidoInternamente: false,
  validadeDias: null,
  criadoEm: '2026-09-30T02:30:03.000Z',
  atualizadoEm: '2026-09-30T02:30:03.000Z',
};

export const mockInsumoBeneficiado: InsumoFixture = {
  id: 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
  nome: 'Maionese da Casa',
  unidade: 'Gramas',
  fatorPerda: 0,
  estoqueAtual: 2500,
  estoqueMinimo: 500,
  custoUnitario: 0.02,
  produzidoInternamente: true,
  validadeDias: 3,
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
};

export const mockInsumoEmAlerta: InsumoFixture = {
  id: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
  nome: 'Pão Brioche',
  unidade: 'Unidade',
  fatorPerda: 0,
  estoqueAtual: 10,
  estoqueMinimo: 50,
  custoUnitario: 2.5,
  produzidoInternamente: false,
  validadeDias: null,
  criadoEm: '2026-09-30T02:30:03.000Z',
  atualizadoEm: '2026-09-30T02:30:03.000Z',
};

export const mockListaInsumos: InsumoFixture[] = [
  mockInsumoBruto,
  mockInsumoBeneficiado,
  mockInsumoEmAlerta,
];

export const mockInsumosAlertas: InsumoFixture[] = [
  mockInsumoEmAlerta,
];

export const mockErroInsumoNaoEncontrado = {
  message: 'Insumo não encontrado',
};

export const mockErroUnidadeComVinculos = {
  message:
    'Não é possível alterar a unidade de medida de um insumo que já possui vínculos ou movimentações registradas (fichas técnicas, perdas ou notas fiscais)',
};

export const mockErroInsumoValidacao = {
  message: 'Dados inválidos',
  issues: [
    {
      code: 'too_big',
      path: ['fatorPerda'],
      message: 'Fator de perda não pode exceder 1 (100%)',
    },
  ],
};

export const mockErroInsumoComVinculoDeletar = {
  message: 'Erro ao deletar o insumo',
};
