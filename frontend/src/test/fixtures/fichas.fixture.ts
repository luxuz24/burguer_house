export interface ItemFichaTecnicaFixture {
  id: string;
  produtoId: string;
  insumoId: string;
  quantidade: number;
  criadoEm: string;
  atualizadoEm: string;
  insumo: {
    id: string;
    nome: string;
    unidade: string;
    custoUnitario: number;
    fatorPerda: number;
    estoqueAtual: number;
  };
}

export const mockItemFichaCarne: ItemFichaTecnicaFixture = {
  id: 'ft-item-001',
  produtoId: 'prod-002',
  insumoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
  quantidade: 150,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  insumo: {
    id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
    nome: 'Carne de Hambúrguer',
    unidade: 'Gramas',
    custoUnitario: 0.045,
    fatorPerda: 0.05,
    estoqueAtual: 5000,
  },
};

export const mockItemFichaPao: ItemFichaTecnicaFixture = {
  id: 'ft-item-002',
  produtoId: 'prod-002',
  insumoId: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
  quantidade: 1,
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  insumo: {
    id: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
    nome: 'Pão Brioche',
    unidade: 'Unidade',
    custoUnitario: 2.5,
    fatorPerda: 0,
    estoqueAtual: 10,
  },
};

export const mockListaFichasDoProduto: ItemFichaTecnicaFixture[] = [
  mockItemFichaCarne,
  mockItemFichaPao,
];

export const mockErroIngredienteDuplicado = {
  message: 'Este insumo já está cadastrado na ficha técnica deste produto',
};

export const mockErroFichaRegistroNaoEncontrado = {
  message: 'Registro não encontrado',
};

export const mockErroFichaQuantidadeInvalida = {
  message: 'Dados inválidos',
  issues: [
    {
      code: 'too_small',
      path: ['quantidade'],
      message: 'Quantidade deve ser maior que zero',
    },
  ],
};
