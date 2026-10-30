import { describe, it, expect } from 'vitest';
import { classificarVenda, extrairEstadoPedido } from './estado_pedido.js';

describe('extrairEstadoPedido', () => {
  it('lê check na raiz, no envelope info e em order, aceitando número em texto', () => {
    expect(extrairEstadoPedido({ check: 1 })).toBe(1);
    expect(extrairEstadoPedido({ success: true, info: { check: 4 } })).toBe(4);
    expect(extrairEstadoPedido({ order: { check: '3' } })).toBe(3);
    expect(extrairEstadoPedido({ check: 0 })).toBe(0);
    expect(extrairEstadoPedido({ check: -2 })).toBe(-2);
  });

  it('retorna null sem check válido', () => {
    expect(extrairEstadoPedido(null)).toBeNull();
    expect(extrairEstadoPedido([{ check: 1 }])).toBeNull();
    expect(extrairEstadoPedido({ items: [] })).toBeNull();
    expect(extrairEstadoPedido({ check: 'abc' })).toBeNull();
    expect(extrairEstadoPedido({ check: '' })).toBeNull();
  });
});

describe('classificarVenda', () => {
  it.each([1, 2, 3])('abate o estoque com check %i', (check) => {
    expect(classificarVenda({ check })).toBe('abater');
  });

  it.each([4, 5, -4, 41, 42])('ignora (não abate) pedido cancelado/negado com check %i', (check) => {
    expect(classificarVenda({ check })).toBe('ignorar');
  });

  it.each([0, -2, -1, -3, 6, 99])('mantém pendente com check %i', (check) => {
    expect(classificarVenda({ check })).toBe('aguardar');
  });

  it('payload sem check ou nulo classifica como aguardar (fail-safe)', () => {
    expect(classificarVenda({ items: [{ name: 'X', quantity: 1 }] })).toBe('aguardar');
    expect(classificarVenda(null)).toBe('aguardar');
  });

  it('check booleano não é tratado como número', () => {
    expect(extrairEstadoPedido({ check: true })).toBeNull();
    expect(extrairEstadoPedido({ check: false })).toBeNull();
    expect(classificarVenda({ check: true })).toBe('aguardar');
  });
});
