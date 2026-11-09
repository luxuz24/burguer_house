export interface NotaFiscalItemFixture {
  id: string;
  insumoId: string;
  descricaoOriginal: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  valorTotal: number;
  quantidadeConvertida: number;
  insumo: {
    id: string;
    nome: string;
    unidade: string;
  };
}

export interface NotaFiscalFixture {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  dataEmissao: string;
  criadoEm: string;
  itens: NotaFiscalItemFixture[];
}

export const mockNotaFiscal: NotaFiscalFixture = {
  id: 'nf-001',
  chaveAcesso: '35261012345678000199550010000012341234567890',
  numero: '1234',
  serie: '1',
  fornecedorNome: 'DISTRIBUIDORA DE ALIMENTOS MS LTDA',
  fornecedorCnpj: '12345678000199',
  valorTotal: 550.0,
  dataEmissao: '2026-10-10T14:30:00.000Z',
  criadoEm: '2026-10-14T08:00:00.000Z',
  itens: [
    {
      id: 'item-nf-001',
      insumoId: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
      descricaoOriginal: 'BACON FATIADO EXTRA',
      unidadeOriginal: 'KG',
      quantidadeOriginal: 10,
      valorUnitario: 32.5,
      valorTotal: 325.0,
      quantidadeConvertida: 10000,
      insumo: {
        id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
        nome: 'Carne de Hambúrguer',
        unidade: 'Gramas',
      },
    },
  ],
};

export const mockListaNotasFiscais: NotaFiscalFixture[] = [
  mockNotaFiscal,
];

export const mockRespostaConfirmarNotaFiscal = {
  notaFiscalId: 'nf-001',
  chaveAcesso: '35261012345678000199550010000012341234567890',
  fornecedorNome: 'DISTRIBUIDORA DE ALIMENTOS MS LTDA',
  totalItensProcessados: 1,
  insumosAtualizados: [
    {
      id: 'e4b6c8d2-4f3b-4c28-98e3-51b8a92357d1',
      nome: 'Carne de Hambúrguer',
      novoEstoque: 15000,
      adicionado: 10000,
      custoUnitario: 0.0325,
    },
  ],
};

export const mockErroNotaFiscalJaImportada = {
  message: 'Nota fiscal já cadastrada com esta chave de acesso',
};
