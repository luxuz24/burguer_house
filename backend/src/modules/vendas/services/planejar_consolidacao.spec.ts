import { describe, it, expect } from 'vitest';
import { planejarConsolidacao, type ProdutoComFichas } from './planejar_consolidacao.js';

describe('planejarConsolidacao (função pura determinística)', () => {
  const carneInsumo = {
    id: 'ins-1',
    nome: 'Carne',
    unidade: 'Gramas',
    fatorPerda: 0.1,
    estoqueAtual: 1000,
  };

  const baconInsumo = {
    id: 'ins-2',
    nome: 'Bacon',
    unidade: 'Gramas',
    fatorPerda: 0,
    estoqueAtual: 500,
  };

  const catalogoPadrao: ProdutoComFichas[] = [
    {
      id: 'prod-1',
      nome: 'X-Burger',
      fichasTecnicas: [
        {
          insumoId: carneInsumo.id,
          quantidade: 100,
          insumo: carneInsumo,
        },
      ],
    },
    {
      id: 'prod-2',
      nome: 'Bacon Extra',
      fichasTecnicas: [
        {
          insumoId: baconInsumo.id,
          quantidade: 50,
          insumo: baconInsumo,
        },
      ],
    },
  ];

  it('planeja dedução com sucesso para venda válida', () => {
    const vendas = [
      {
        id: 'v-1',
        atualizadoEm: new Date(),
        payloadOriginal: { check: 1, items: [{ name: 'x-burger', quantity: 2 }] },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoPadrao);

    expect(plano.vendasAAbater).toHaveLength(1);
    expect(plano.vendasPendentesNaoMapeadas).toBe(0);
    // 2 x-burgers * 100 * (1 + 0.1) = 220
    const descCarne = plano.descontosPorInsumo.get('ins-1');
    expect(descCarne?.desconto).toBeCloseTo(220);
  });

  it('B: venda com item inválido (sem quantidade) fica pendente e não é consumida parcialmente', () => {
    const vendas = [
      {
        id: 'v-invalida',
        atualizadoEm: new Date(),
        payloadOriginal: {
          check: 1,
          items: [
            { name: 'X-Burger', quantity: 1 },
            { name: 'Bacon Extra' }, // falta quantity!
          ],
        },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoPadrao);

    expect(plano.vendasAAbater).toHaveLength(0);
    expect(plano.vendasComItensInvalidos).toHaveLength(1);
    expect(plano.vendasPendentesNaoMapeadas).toBe(1);
    expect(plano.itensInvalidos).toHaveLength(1);
    expect(plano.itensInvalidos[0].motivo).toContain('quantidade');
    expect(plano.descontosPorInsumo.size).toBe(0);
  });

  it('C: produto sem ficha técnica deixa a venda pendente e lista em produtosSemFicha', () => {
    const catalogoComProdutoSemFicha: ProdutoComFichas[] = [
      ...catalogoPadrao,
      {
        id: 'prod-sem-ficha',
        nome: 'Refrigerante 350ml',
        fichasTecnicas: [], // sem ficha cadastrada!
      },
    ];

    const vendas = [
      {
        id: 'v-sem-ficha',
        atualizadoEm: new Date(),
        payloadOriginal: {
          check: 1,
          items: [{ name: 'Refrigerante 350ml', quantity: 2 }],
        },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoComProdutoSemFicha);

    expect(plano.vendasAAbater).toHaveLength(0);
    expect(plano.produtosSemFicha).toEqual(['Refrigerante 350ml']);
    expect(plano.vendasPendentesNaoMapeadas).toBe(1);
    expect(plano.descontosPorInsumo.size).toBe(0);
  });

  it('D: colisão de nomes no catálogo (ex: "X-Burger" e "X Burger") deixa a venda pendente e sinaliza', () => {
    const catalogoComColisao: ProdutoComFichas[] = [
      catalogoPadrao[0], // "X-Burger"
      {
        id: 'prod-colisao',
        nome: 'X Burger', // normaliza para a mesma chave "x burger"
        fichasTecnicas: [],
      },
    ];

    const vendas = [
      {
        id: 'v-colisao',
        atualizadoEm: new Date(),
        payloadOriginal: {
          check: 1,
          items: [{ name: 'X-Burger', quantity: 1 }],
        },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoComColisao);

    expect(plano.vendasAAbater).toHaveLength(0);
    expect(plano.produtosComColisaoNome).toContain('X-Burger');
    expect(plano.vendasPendentesNaoMapeadas).toBe(1);
    expect(plano.descontosPorInsumo.size).toBe(0);
  });

  it('separa canceladas em vendasAIgnorar e aguardando em vendasAguardando sem inflar vendasAguardando', () => {
    const vendas = [
      {
        id: 'v-cancelada',
        atualizadoEm: new Date(),
        payloadOriginal: { check: 4, items: [{ name: 'X-Burger', quantity: 1 }] },
      },
      {
        id: 'v-aguardando',
        atualizadoEm: new Date(),
        payloadOriginal: { check: 0, items: [{ name: 'X-Burger', quantity: 1 }] },
      },
      {
        id: 'v-nao-mapeada',
        atualizadoEm: new Date(),
        payloadOriginal: { check: 1, items: [{ name: 'Fantasma', quantity: 1 }] },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoPadrao);

    expect(plano.vendasAIgnorar).toHaveLength(1);
    expect(plano.vendasAguardando).toHaveLength(1);
    expect(plano.vendasPendentesNaoMapeadas).toBe(1);
    expect(plano.produtosNaoEncontrados).toEqual(['Fantasma']);
  });

  it('calcula adicionais de subItems com multiplicador do item principal', () => {
    const vendas = [
      {
        id: 'v-sub',
        atualizadoEm: new Date(),
        payloadOriginal: {
          check: 1,
          items: [
            {
              name: 'X-Burger',
              quantity: 2,
              subItems: [{ name: 'Bacon Extra', quantity: 1 }],
            },
          ],
        },
      },
    ];

    const plano = planejarConsolidacao(vendas, catalogoPadrao);

    expect(plano.vendasAAbater).toHaveLength(1);
    expect(plano.vendasPendentesNaoMapeadas).toBe(0);
    // 2 x-burgers * 100g * 1.1 = 220g carne
    expect(plano.descontosPorInsumo.get('ins-1')?.desconto).toBeCloseTo(220);
    // 2 x-burgers * (1 bacon * 50g) = 100g bacon
    expect(plano.descontosPorInsumo.get('ins-2')?.desconto).toBeCloseTo(100);
  });
});
