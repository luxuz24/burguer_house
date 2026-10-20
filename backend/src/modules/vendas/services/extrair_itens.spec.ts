import { describe, it, expect } from 'vitest';
import { extrairItens } from './extrair_itens.js';

describe('extrairItens', () => {
  it('lê items, order.items, array na raiz e campos em português', () => {
    const base = [{ name: 'X-Bacon', quantity: 2, price: 25 }];
    expect(extrairItens({ items: base })).toEqual([{ nome: 'X-Bacon', quantidade: 2, preco: 25 }]);
    expect(extrairItens({ order: { items: base } })).toEqual([{ nome: 'X-Bacon', quantidade: 2, preco: 25 }]);
    expect(extrairItens(base)).toEqual([{ nome: 'X-Bacon', quantidade: 2, preco: 25 }]);
    expect(extrairItens({ items: [{ nome: 'Coca', quantidade: '3', preco: 6 }] })).toEqual([
      { nome: 'Coca', quantidade: 3, preco: 6 },
    ]);
  });

  it('nunca lança e descarta itens inválidos', () => {
    expect(extrairItens(null)).toEqual([]);
    expect(extrairItens('texto')).toEqual([]);
    expect(extrairItens({ items: {} })).toEqual([]);
    expect(extrairItens({ items: 'x' })).toEqual([]);
    expect(
      extrairItens({
        items: [
          null,
          'solto',
          { name: '', quantity: 1 },
          { name: 'A', quantity: 'abc' },
          { name: 'B', quantity: -1 },
          { name: 'Ok', quantity: 1, price: 'caro' },
        ],
      }),
    ).toEqual([{ nome: 'Ok', quantidade: 1, preco: 0 }]);
  });
});

describe('extrairItens (envelope da API de pedidos da Anota AI)', () => {
  it('lê os itens de info.items', () => {
    expect(
      extrairItens({ success: true, info: { id: 'p1', check: 1, items: [{ name: 'Refrigerante 1L', quantity: 1, price: 10, total: 10 }] } }),
    ).toEqual([{ nome: 'Refrigerante 1L', quantidade: 1, preco: 10 }]);
  });
});
