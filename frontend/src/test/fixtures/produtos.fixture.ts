export interface ProdutoFixture {
  id: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
  fichasTecnicas?: {
    id: string;
    produtoId: string;
    insumoId: string;
    quantidade: number;
    insumo: {
      id: string;
      nome: string;
      unidade: string;
      custoUnitario: number;
      fatorPerda: number;
      estoqueAtual: number;
    };
  }[];
}

export const mockProdutoSimples: ProdutoFixture = {
  id: 'prod-001',
  nome: 'X-Burguer Tradicional',
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
};

export const mockProdutoComFicha: ProdutoFixture = {
  id: 'prod-002',
  nome: 'X-Bacon House',
  criadoEm: '2026-10-01T12:00:00.000Z',
  atualizadoEm: '2026-10-01T12:00:00.000Z',
  fichasTecnicas: [
    {
      id: 'ft-001',
      produtoId: 'prod-002',
      insumoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
      quantidade: 150,
      insumo: {
        id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
        nome: 'Carne de Hambúrguer',
        unidade: 'Gramas',
        custoUnitario: 0.045,
        fatorPerda: 0.05,
        estoqueAtual: 5000,
      },
    },
    {
      id: 'ft-002',
      produtoId: 'prod-002',
      insumoId: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
      quantidade: 1,
      insumo: {
        id: '7a3f8b1c-921d-4a1e-8e5f-1a2b3c4d5e6f',
        nome: 'Pão Brioche',
        unidade: 'Unidade',
        custoUnitario: 2.5,
        fatorPerda: 0,
        estoqueAtual: 10,
      },
    },
  ],
};

export const mockListaProdutos: ProdutoFixture[] = [
  mockProdutoSimples,
  mockProdutoComFicha,
];

export const mockErroProdutoNaoEncontrado = {
  message: 'Produto não encontrado',
};

export const mockErroColisaoNomeProduto = {
  message: 'Já existe um produto com nome equivalente cadastrado: "X-Bacon House"',
  produtoConflito: {
    id: 'prod-002',
    nome: 'X-Bacon House',
  },
};

export const mockErroProdutoNomeInvalido = {
  message: 'Dados inválidos',
  issues: [
    {
      code: 'custom',
      path: ['nome'],
      message: 'O nome do produto deve conter ao menos uma letra ou número',
    },
  ],
};
