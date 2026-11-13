import { describe, it, expect } from 'vitest';
import { anonimizarPayloadVenda } from './anonimizar_payload.js';

describe('anonimizarPayloadVenda', () => {
  it('remove objetos e campos de dados pessoais preservando estrutura oficial do pedido', () => {
    const payloadComPii = {
      id: 'ped-oficial-900',
      check: 1,
      customer: {
        name: 'Maria Silva',
        phone: '67999998888',
        email: 'maria@exemplo.com',
        cpf: '12345678900',
      },
      deliveryAddress: {
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Centro',
        cep: '79000-000',
      },
      info: {
        id: 'ped-oficial-900',
        check: 1,
        cliente: { nome: 'Maria', telefone: '67999998888' },
        endereco: 'Rua A, 10',
        nomeCliente: 'Maria',
        items: [
          {
            externalId: 'sku-01',
            name: 'Bacon House',
            quantity: 2,
            price: 34.9,
            observation: 'Sem cebola',
            subItems: [
              {
                externalId: 'add-01',
                name: 'Bacon Extra',
                quantity: 1,
                price: 6,
              },
            ],
          },
        ],
      },
    };

    const limpo = anonimizarPayloadVenda(payloadComPii) as Record<string, any>;
    const serializado = JSON.stringify(limpo);

    expect(serializado).not.toContain('Maria');
    expect(serializado).not.toContain('67999998888');
    expect(serializado).not.toContain('maria@exemplo.com');
    expect(serializado).not.toContain('12345678900');
    expect(serializado).not.toContain('Rua das Flores');
    expect(serializado).not.toContain('customer');
    expect(serializado).not.toContain('deliveryAddress');
    expect(serializado).not.toContain('endereco');
    expect(serializado).not.toContain('cliente');

    expect(limpo).toEqual({
      id: 'ped-oficial-900',
      check: 1,
      info: {
        id: 'ped-oficial-900',
        check: 1,
        items: [
          {
            externalId: 'sku-01',
            name: 'Bacon House',
            quantity: 2,
            price: 34.9,
            observation: 'Sem cebola',
            subItems: [
              {
                externalId: 'add-01',
                name: 'Bacon Extra',
                quantity: 1,
                price: 6,
              },
            ],
          },
        ],
      },
    });
  });
});
