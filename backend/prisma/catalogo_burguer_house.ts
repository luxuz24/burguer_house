// Catálogo real da Burguer House, extraído da planilha "Precificação Burguer House.xlsx" (18/11/2026):
// abas 6 (insumos), 7 (receitas internas), 4 e 8 (cardápio e fichas técnicas).
// - custoUnitario: "Preço Real" da planilha (preço por unidade de medida, já considerando a perda).
// - fatorPerda: coluna "Perda (%)" da planilha.
// - Linhas repetidas de um mesmo insumo numa ficha foram somadas (ex.: maionese no lanche + potinho):
//   assim o custo de cada produto bate com o "Custo do Produto" da planilha (conferido no spec).
// - Estoque e estoque mínimo não vêm daqui: em produção começam zerados (a loja faz a primeira contagem).

export type UnidadeCatalogo = 'Unidade' | 'Gramas' | 'Mililitros';
export type CategoriaCatalogo = 'INGREDIENTE' | 'EMBALAGEM' | 'BEBIDA';

export interface InsumoCatalogo {
  nome: string;
  unidade: UnidadeCatalogo;
  categoria: CategoriaCatalogo;
  fatorPerda: number;
  custoUnitario: number;
  produzidoInternamente?: true;
  validadeDias?: number;
}

export interface ItemCatalogo {
  insumo: string;
  quantidade: number;
}

/** Receita interna: `ingredientes` para produzir `rendimento` (na unidade do beneficiado). */
export interface ReceitaCatalogo {
  beneficiado: string;
  rendimento: number;
  ingredientes: ItemCatalogo[];
  /** "Custo da Receita" da planilha, para conferência. */
  custoPlanilha: number;
}

export interface ProdutoCatalogo {
  nome: string;
  ficha: ItemCatalogo[];
  /** "Custo do Produto" da planilha, para conferência (null quando a planilha não tem ficha). */
  custoPlanilha: number | null;
}

export const INSUMOS_CATALOGO: InsumoCatalogo[] = [
  { nome: 'Pão Brioche', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 2.11 },
  { nome: 'Carne de Hambúrguer', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0319 },
  { nome: 'Bacon fatiado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.035 },
  { nome: 'Queijo Mussarela Fatia', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.37 },
  { nome: 'Queijo Cheddar Fatia', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.46 },
  { nome: 'Alface Americana', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0246 },
  { nome: 'Tomate', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.00599 },
  { nome: 'Rúcula', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.5, custoUnitario: 0.036 },
  { nome: 'Cebola branca', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.105, custoUnitario: 0.003229 },
  { nome: 'Molho Barbecue', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.011143 },
  { nome: 'Geleia de Pimenta', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.044 },
  { nome: 'Frango Empanado', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 3.599 },
  { nome: 'Batata Frita Bem Brasil', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.01475 },
  { nome: 'Batata Inglesa', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.03, custoUnitario: 0.006175 },
  { nome: 'Cebola Roxa', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.105, custoUnitario: 0.00781 },
  { nome: 'Maionese da Casa - Beneficiado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.00902, produzidoInternamente: true, validadeDias: 5 },
  { nome: 'Mussarela Empanada - Beneficiado', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 2.47, produzidoInternamente: true, validadeDias: 3 },
  { nome: 'Carne seca com requeijão - Beneficiado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0, produzidoInternamente: true, validadeDias: 5 },
  { nome: 'Cebola Caremelizada - Beneficiado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.00605, produzidoInternamente: true, validadeDias: 7 },
  { nome: 'Sal Fino', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.00275 },
  { nome: 'Óleo de soja', unidade: 'Mililitros', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.006656 },
  { nome: 'Alho desidratado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.049 },
  { nome: 'Mostarda em pó desidratada', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.049 },
  { nome: 'Manjericão', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0223 },
  { nome: 'Cebolinha', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.03245 },
  { nome: 'Salsinha', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0649 },
  { nome: 'Hortelã', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0499 },
  { nome: 'Leite', unidade: 'Mililitros', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.00379 },
  { nome: 'Shoyu', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.007081 },
  { nome: 'Açúcar', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0055 },
  { nome: 'Panko', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.0249 },
  { nome: 'Ovo', unidade: 'Unidade', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.5 },
  { nome: 'Queijo Mussarela para empanamento', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.02995 },
  { nome: 'Papel Acoplado', unidade: 'Unidade', categoria: 'EMBALAGEM', fatorPerda: 0, custoUnitario: 0.3 },
  { nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 3.05 },
  { nome: 'Coca Cola Original 350ml', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 3.05 },
  { nome: 'Coca Cola 600mL', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 4.1 },
  { nome: 'Coca Cola Zero 600ml', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 4.1 },
  { nome: 'agua com gás', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 1.55 },
  { nome: 'agua sem gás', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 1.44 },
  { nome: 'heineken long neck', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 5.91 },
  { nome: 'coca litro', unidade: 'Unidade', categoria: 'BEBIDA', fatorPerda: 0, custoUnitario: 4 },
  { nome: 'Embalagem de molho (potinho)', unidade: 'Unidade', categoria: 'EMBALAGEM', fatorPerda: 0, custoUnitario: 0.22 },
  { nome: 'Palito de madeira', unidade: 'Unidade', categoria: 'EMBALAGEM', fatorPerda: 0, custoUnitario: 0.1 },
  { nome: 'Embalagem de Batata', unidade: 'Unidade', categoria: 'EMBALAGEM', fatorPerda: 0, custoUnitario: 0.03 },
  { nome: 'Margarina', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.020792 },
  { nome: 'Saco Kraft Delivery', unidade: 'Unidade', categoria: 'EMBALAGEM', fatorPerda: 0, custoUnitario: 0.71 },
  { nome: 'Crispy Mandioca - Beneficiado', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.014, produzidoInternamente: true, validadeDias: 10 },
  { nome: 'Mandioca', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0, custoUnitario: 0.007 },
];

export const RECEITAS_CATALOGO: ReceitaCatalogo[] = [
  {
    beneficiado: 'Maionese da Casa - Beneficiado',
    rendimento: 1558,
    custoPlanilha: 14.053522,
    ingredientes: [
      { insumo: 'Óleo de soja', quantidade: 967 },
      { insumo: 'Alho desidratado', quantidade: 20 },
      { insumo: 'Mostarda em pó desidratada', quantidade: 14 },
      { insumo: 'Sal Fino', quantidade: 14 },
      { insumo: 'Manjericão', quantidade: 4 },
      { insumo: 'Cebolinha', quantidade: 34 },
      { insumo: 'Salsinha', quantidade: 42 },
      { insumo: 'Hortelã', quantidade: 2 },
      { insumo: 'Leite', quantidade: 500 },
    ],
  },
  {
    beneficiado: 'Cebola Caremelizada - Beneficiado',
    rendimento: 400,
    custoPlanilha: 2.418008,
    ingredientes: [
      { insumo: 'Cebola branca', quantidade: 440 },
      { insumo: 'Shoyu', quantidade: 102 },
      { insumo: 'Açúcar', quantidade: 50 },
    ],
  },
  {
    beneficiado: 'Mussarela Empanada - Beneficiado',
    rendimento: 1,
    custoPlanilha: 2.4703,
    ingredientes: [
      { insumo: 'Queijo Mussarela para empanamento', quantidade: 60 },
      { insumo: 'Panko', quantidade: 17 },
      { insumo: 'Ovo', quantidade: 0.5 },
    ],
  },
  {
    beneficiado: 'Crispy Mandioca - Beneficiado',
    rendimento: 1000,
    custoPlanilha: 14,
    ingredientes: [
      { insumo: 'Mandioca', quantidade: 2000 },
    ],
  },
];

export const PRODUTOS_CATALOGO: ProdutoCatalogo[] = [
  {
    nome: 'BACON HOUSE',
    custoPlanilha: 11.005934,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Bacon fatiado', quantidade: 32 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 80 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  {
    nome: 'HOUSE DUPLO',
    custoPlanilha: 15.88342,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 320 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 4 },
      { insumo: 'Molho Barbecue', quantidade: 30 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 40 },
    ],
  },
  {
    nome: 'SELADINHO HOUSE',
    custoPlanilha: 9.525134,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 40 },
    ],
  },
  {
    nome: 'HOUSE CARAMELIZADO',
    custoPlanilha: 11.368934,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Cebola Caremelizada - Beneficiado', quantidade: 60 },
      { insumo: 'Bacon fatiado', quantidade: 32 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 80 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  {
    nome: 'MUSSARELA HOUSE',
    custoPlanilha: 13.275534,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Mussarela Empanada - Beneficiado', quantidade: 1 },
      { insumo: 'Geleia de Pimenta', quantidade: 25 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 60 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  {
    nome: 'RÚCULA HOUSE',
    custoPlanilha: 11.33942,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Bacon fatiado', quantidade: 32 },
      { insumo: 'Molho Barbecue', quantidade: 30 },
      { insumo: 'Rúcula', quantidade: 10 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 40 },
    ],
  },
  {
    nome: 'HOUSE PANTENEIRO',
    custoPlanilha: 14.876984,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 310 },
      { insumo: 'Queijo Mussarela Fatia', quantidade: 2 },
      { insumo: 'Tomate', quantidade: 20 },
      { insumo: 'Crispy Mandioca - Beneficiado', quantidade: 20 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 80 },
      { insumo: 'Margarina', quantidade: 2 },
    ],
  },
  {
    nome: 'CHICKEN SUPREME',
    custoPlanilha: 8.798984,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Frango Empanado', quantidade: 1 },
      { insumo: 'Queijo Mussarela Fatia', quantidade: 2 },
      { insumo: 'Alface Americana', quantidade: 20 },
      { insumo: 'Tomate', quantidade: 20 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 80 },
      { insumo: 'Margarina', quantidade: 2 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  // Sem ficha técnica na planilha: cadastrado sem ficha (venda fica retida até a loja completar no app).
  { nome: 'CHICKEN HOUSE', custoPlanilha: null, ficha: [] },
  {
    nome: 'BATATA CHIPS CROCANTE',
    custoPlanilha: 0.846534,
    ficha: [
      { insumo: 'Batata Inglesa', quantidade: 130 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Embalagem de Batata', quantidade: 1 },
    ],
  },
  {
    nome: 'BATATA CRINKLE',
    custoPlanilha: 2.99375,
    ficha: [
      { insumo: 'Batata Frita Bem Brasil', quantidade: 200 },
      { insumo: 'Sal Fino', quantidade: 5 },
      { insumo: 'Embalagem de Batata', quantidade: 1 },
    ],
  },
  {
    nome: 'COCA COLA 350ML',
    custoPlanilha: 3.05,
    ficha: [
      { insumo: 'Coca Cola Original 350ml', quantidade: 1 },
    ],
  },
  {
    nome: 'COCA COLA ZERO 350ML',
    custoPlanilha: 3.05,
    ficha: [
      { insumo: 'Coca Cola Zero 350ml', quantidade: 1 },
    ],
  },
  {
    nome: 'COCA COLA 600ML',
    custoPlanilha: 4.1,
    ficha: [
      { insumo: 'Coca Cola 600mL', quantidade: 1 },
    ],
  },
  {
    nome: 'COCA COLA ZERO 600ML',
    custoPlanilha: 4.1,
    ficha: [
      { insumo: 'Coca Cola Zero 600ml', quantidade: 1 },
    ],
  },
  {
    nome: 'ÁGUA COM GÁS',
    custoPlanilha: 1.55,
    ficha: [
      { insumo: 'agua com gás', quantidade: 1 },
    ],
  },
  {
    nome: 'ÁGUA SEM GÁS',
    custoPlanilha: 1.44,
    ficha: [
      { insumo: 'agua sem gás', quantidade: 1 },
    ],
  },
  {
    nome: 'HEINEKEN LONG NECK',
    custoPlanilha: 5.91,
    ficha: [
      { insumo: 'heineken long neck', quantidade: 1 },
    ],
  },
  {
    nome: 'COCA COLA LITRO',
    custoPlanilha: 4,
    ficha: [
      { insumo: 'coca litro', quantidade: 1 },
    ],
  },
  {
    nome: 'MAIONESE HOUSE',
    custoPlanilha: 0.5808,
    ficha: [
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 40 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  {
    nome: 'BARBECUE HOUSE',
    custoPlanilha: 0.665714,
    ficha: [
      { insumo: 'Molho Barbecue', quantidade: 40 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
    ],
  },
  {
    nome: 'HOUSE SALADA',
    custoPlanilha: 10.483984,
    ficha: [
      { insumo: 'Pão Brioche', quantidade: 1 },
      { insumo: 'Carne de Hambúrguer', quantidade: 160 },
      { insumo: 'Queijo Cheddar Fatia', quantidade: 2 },
      { insumo: 'Alface Americana', quantidade: 20 },
      { insumo: 'Tomate', quantidade: 20 },
      { insumo: 'Saco Kraft Delivery', quantidade: 0.5 },
      { insumo: 'Palito de madeira', quantidade: 1 },
      { insumo: 'Papel Acoplado', quantidade: 1 },
      { insumo: 'Embalagem de molho (potinho)', quantidade: 1 },
      { insumo: 'Maionese da Casa - Beneficiado', quantidade: 80 },
      { insumo: 'Margarina', quantidade: 2 },
    ],
  },
];
