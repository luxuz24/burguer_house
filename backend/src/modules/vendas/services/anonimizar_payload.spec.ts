import { describe, it, expect } from 'vitest';
import { anonimizarPayloadVenda } from './anonimizar_payload.js';

describe('anonimizarPayloadVenda', () => {
  it('remove tudo fora da allowlist e redige observation/note no payload completo com PII', () => {
    const payloadComPii = {
      info: {
        id: 'abc',
        check: 1,
        customer: {
          id: 'c1',
          name: 'Maria Silva',
          phone: '67911112222',
          taxPayerIdentificationNumber: '12345678900',
        },
        waiter_info: { waiter: 'w1', waiter_name: 'Joao Garcom' },
        client_name: 'Maria Silva',
        client_phone: '67911112222',
        observation: 'Entregar para Maria na casa azul, tel 67 91111-2222',
        note: 'Cliente Pedro ligou antes',
        qr_description: 'Mesa 5',
        payments: [{ name: 'pix', code: 'PIX', prepaid: true, value: '10', changeFor: 50 }],
        ifood_pickup_code: '4883',
        discounts: [{ tag: 'CUPOM10', amount: 5, target: 'CART', motivoSecreto: 'Maria' }],
        schedule_order: {
          date: '2026-11-12',
          start: '19:00',
          end: '20:00',
          timezone: 'America/Campo_Grande',
          clientNote: 'Joao',
        },
        items: [
          {
            id: 'item-1',
            name: 'X-Burger',
            quantity: 1,
            price: 30,
            total: 30,
            externalId: 'ext-1',
            internalId: 'int-1',
            externalCode: 'cod-1',
            observation: 'sem cebola, é para o Pedro',
            campoDesconhecido: 'Silva',
            subItems: [
              {
                name: 'Bacon Extra',
                quantity: 1,
                price: 5,
                total: 5,
                externalCode: 'sub-1',
                quantityFraction: 1,
                valueFraction: 5,
                observation: 'bem passado para Joao',
                campoExtraPii: 'casa azul',
              },
            ],
          },
        ],
      },
    };

    const limpo = anonimizarPayloadVenda(payloadComPii) as Record<string, any>;
    const serializado = JSON.stringify(limpo);

    for (const proibido of [
      'Maria',
      'Silva',
      'Joao',
      'Pedro',
      '67911112222',
      '91111',
      '12345678900',
      '4883',
      'casa azul',
      'waiter_info',
      'client_name',
      'client_phone',
      'qr_description',
      'ifood_pickup_code',
      'changeFor',
      'motivoSecreto',
      'clientNote',
      'campoDesconhecido',
      'campoExtraPii',
    ]) {
      expect(serializado).not.toContain(proibido);
    }

    expect(limpo).toEqual({
      info: {
        id: 'abc',
        check: 1,
        observation: '<observacao-removida>',
        note: '<observacao-removida>',
        payments: [{ name: 'pix', code: 'PIX', prepaid: true }],
        discounts: [{ tag: 'CUPOM10', amount: 5, target: 'CART' }],
        schedule_order: {
          date: '2026-11-12',
          start: '19:00',
          end: '20:00',
          timezone: 'America/Campo_Grande',
        },
        items: [
          {
            id: 'item-1',
            name: 'X-Burger',
            quantity: 1,
            price: 30,
            total: 30,
            externalId: 'ext-1',
            internalId: 'int-1',
            externalCode: 'cod-1',
            observation: '<observacao-removida>',
            subItems: [
              {
                name: 'Bacon Extra',
                quantity: 1,
                price: 5,
                total: 5,
                externalCode: 'sub-1',
                quantityFraction: 1,
                valueFraction: 5,
                observation: '<observacao-removida>',
              },
            ],
          },
        ],
      },
    });
  });

  it('preserva campos permitidos do formato oficial da API de parceiros (info.items) e omite observation vazia', () => {
    const oficial = {
      _id: 'oid-1',
      id: 'id-1',
      check: 2,
      shortReference: '0042',
      type: 'DELIVERY',
      salesChannel: 'ANOTAAI',
      createdAt: '2026-11-12T22:00:00.000Z',
      updatedAt: '2026-11-12T22:05:00.000Z',
      total: 42.9,
      deliveryFee: 8,
      observation: '   ',
      info: {
        id: 'id-1',
        check: 2,
        items: [
          {
            name: 'Bacon House',
            quantity: 1,
            price: 34.9,
            observation: '',
            note: null,
            externalId: 'sku-01',
            subItems: [],
          },
        ],
      },
      order: {
        id: 'ord-1',
        check: 2,
        items: [],
      },
    };

    const limpo = anonimizarPayloadVenda(oficial);
    expect(limpo).toEqual({
      _id: 'oid-1',
      id: 'id-1',
      check: 2,
      shortReference: '0042',
      type: 'DELIVERY',
      salesChannel: 'ANOTAAI',
      createdAt: '2026-11-12T22:00:00.000Z',
      updatedAt: '2026-11-12T22:05:00.000Z',
      total: 42.9,
      deliveryFee: 8,
      info: {
        id: 'id-1',
        check: 2,
        items: [
          {
            name: 'Bacon House',
            quantity: 1,
            price: 34.9,
            externalId: 'sku-01',
            subItems: [],
          },
        ],
      },
      order: {
        id: 'ord-1',
        check: 2,
        items: [],
      },
    });
  });

  it('no formato interno do painel (nm_itens, client_name, title, amount), descarta tudo fora da allowlist sem vazar nada', () => {
    const internoPainel = {
      client_name: 'Maria Silva',
      client_phone: '67911112222',
      nm_itens: [{ title: 'X-Burger', amount: 2, obs: 'casa azul' }],
      total: 60,
    };

    const limpo = anonimizarPayloadVenda(internoPainel);
    const serializado = JSON.stringify(limpo);

    expect(serializado).not.toContain('Maria');
    expect(serializado).not.toContain('67911112222');
    expect(serializado).not.toContain('nm_itens');
    expect(serializado).not.toContain('title');
    expect(serializado).not.toContain('amount');
    expect(serializado).not.toContain('casa azul');
    expect(limpo).toEqual({ total: 60 });
  });

  it('trata raiz não-objeto, array de pedidos e objetos aninhados inesperados em campos primitivos com falha segura', () => {
    expect(anonimizarPayloadVenda(null)).toEqual({});
    expect(anonimizarPayloadVenda('Maria')).toEqual({});
    expect(anonimizarPayloadVenda([{ id: 'p1', customer: { name: 'Maria' } }])).toEqual([
      { id: 'p1' },
    ]);
    expect(
      anonimizarPayloadVenda({
        id: { vaza: 'Maria' },
        payments: 'invalido',
        discounts: ['invalido'],
        schedule_order: ['invalido'],
        info: null,
        order: 'Maria',
        items: [{ name: 'Burger', subItems: ['invalido'] }],
      }),
    ).toEqual({
      discounts: [],
      items: [{ name: 'Burger', subItems: [] }],
    });
  });
});
