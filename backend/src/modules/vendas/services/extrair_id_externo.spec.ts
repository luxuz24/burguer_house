import { describe, it, expect } from 'vitest';
import { extrairIdExterno } from './extrair_id_externo.js';

describe('extrairIdExterno', () => {
  it('extrai ID do pedido na raiz (id, _id, orderId, externalId) ou numérico', () => {
    expect(extrairIdExterno({ id: 'ped-123', items: [] })).toBe('ped-123');
    expect(extrairIdExterno({ _id: '652f1a9b', items: [] })).toBe('652f1a9b');
    expect(extrairIdExterno({ orderId: 987654 })).toBe('987654');
    expect(extrairIdExterno({ externalId: '  ext-01  ' })).toBe('ext-01');
  });

  it('extrai ID aninhado em order, pedido ou data', () => {
    expect(extrairIdExterno({ order: { id: 'ord-99', items: [] } })).toBe('ord-99');
    expect(extrairIdExterno({ pedido: { _id: 'ped-abc' } })).toBe('ped-abc');
    expect(extrairIdExterno({ data: { order_id: 'dt-77' } })).toBe('dt-77');
  });

  it('prioriza ID do pedido no payload sobre headers de evento', () => {
    expect(
      extrairIdExterno({ id: 'body-id' }, { 'x-webhook-id': 'hdr-id-1' }),
    ).toBe('body-id');
    expect(
      extrairIdExterno({}, { 'x-idempotency-key': 'idem-42' }),
    ).toBe('idem-42');
  });

  it('retorna null quando não há identificador válido', () => {
    expect(extrairIdExterno({ items: [{ name: 'X-Burger', quantity: 1 }] })).toBeNull();
    expect(extrairIdExterno(null)).toBeNull();
    expect(extrairIdExterno([{ name: 'X' }])).toBeNull();
    expect(extrairIdExterno({ id: '   ' })).toBeNull();
  });
});

describe('extrairIdExterno (envelope da API de pedidos da Anota AI)', () => {
  it('extrai o id de info.id', () => {
    expect(extrairIdExterno({ success: true, info: { _id: '66b6258e890ffb00126c4233', check: 1 } })).toBe('66b6258e890ffb00126c4233');
  });
});
