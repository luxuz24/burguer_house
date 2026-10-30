import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AnotaAIAdapter,
  normalizarNomeProduto,
} from './anotaai.adapter.js';

function carregarFixture(nome: string): unknown {
  const caminho = resolve(__dirname, '../fixtures/anotaai', nome);
  return JSON.parse(readFileSync(caminho, 'utf-8'));
}

describe('AnotaAIAdapter', () => {
  const adapter = new AnotaAIAdapter();

  it('interpreta pedido_aceito.json com check 1 e destino abater', () => {
    const fixture = carregarFixture('pedido_aceito.json');
    const res = adapter.parsear(fixture);

    expect(res.valido).toBe(true);
    expect(res.externalId).toBe('ped-101');
    expect(res.check).toBe(1);
    expect(res.destino).toBe('abater');
    expect(res.itens).toHaveLength(1);
    expect(res.itens[0]).toEqual({
      nome: 'X-Bacon',
      quantidade: 2,
      preco: 25,
    });
  });

  it('interpreta pedido_cancelado.json com check 4 e destino ignorar', () => {
    const fixture = carregarFixture('pedido_cancelado.json');
    const res = adapter.parsear(fixture);

    expect(res.valido).toBe(true);
    expect(res.externalId).toBe('ped-102');
    expect(res.check).toBe(4);
    expect(res.destino).toBe('ignorar');
  });

  it('interpreta pedido_agendado.json com check -2 e destino aguardar', () => {
    const fixture = carregarFixture('pedido_agendado.json');
    const res = adapter.parsear(fixture);

    expect(res.valido).toBe(true);
    expect(res.externalId).toBe('ped-103');
    expect(res.check).toBe(-2);
    expect(res.destino).toBe('aguardar');
  });

  it('extrai subItems de pedido_com_adicionais.json', () => {
    const fixture = carregarFixture('pedido_com_adicionais.json');
    const res = adapter.parsear(fixture);

    expect(res.valido).toBe(true);
    expect(res.externalId).toBe('ped-104');
    expect(res.check).toBe(2);
    expect(res.destino).toBe('abater');
    expect(res.itens).toHaveLength(1);
    expect(res.itens[0].subItens).toEqual([
      {
        nome: 'Bacon Extra',
        quantidade: 1,
        preco: 5,
      },
    ]);
  });

  it('interpreta pedido_sem_itens.json como válido porém com itens vazio', () => {
    const fixture = carregarFixture('pedido_sem_itens.json');
    const res = adapter.parsear(fixture);

    expect(res.valido).toBe(true);
    expect(res.externalId).toBe('ped-105');
    expect(res.check).toBe(1);
    expect(res.itens).toEqual([]);
  });

  it('payload_desconhecido.json classifica como destino aguardar (fail-safe: nunca abater)', () => {
    const fixture = carregarFixture('payload_desconhecido.json');
    const res = adapter.parsear(fixture);

    expect(res.check).toBeNull();
    expect(res.destino).toBe('aguardar');
  });

  it('não aceita check booleano (check: true) como número 1', () => {
    const res = adapter.parsear({ check: true });
    expect(res.check).toBeNull();
    expect(res.destino).toBe('aguardar');
  });

  it('prioriza ID do pedido no corpo sobre x-event-id dos headers', () => {
    const res = adapter.parsear(
      { id: 'ped-real', check: 1 },
      { 'x-event-id': 'evt-transmissao-99' },
    );
    expect(res.externalId).toBe('ped-real');
  });

  it('usa header de idempotência como fallback quando corpo não tem ID', () => {
    const res = adapter.parsear(
      { check: 1 },
      { 'x-event-id': 'evt-transmissao-99' },
    );
    expect(res.externalId).toBe('evt-transmissao-99');
  });

  it('lê header de idempotência em maiúsculo (X-WEBHOOK-ID)', () => {
    const res = adapter.parsear(
      { check: 1 },
      { 'X-WEBHOOK-ID': 'evt-maiusculo' },
    );
    expect(res.externalId).toBe('evt-maiusculo');
  });

  it('retorna valido: false para payloads primitivos ou nulos', () => {
    expect(adapter.parsear(null).valido).toBe(false);
    expect(adapter.parsear('texto solto').valido).toBe(false);
    expect(adapter.parsear(123).valido).toBe(false);
  });

  it('rejeita IDs maiores que 255 caracteres ou números infinitos/NaN', () => {
    expect(adapter.extrairIdExterno({ id: 'a'.repeat(256) })).toBeNull();
    expect(adapter.extrairIdExterno({ id: 'a'.repeat(255) })).toBe('a'.repeat(255));
    expect(adapter.extrairIdExterno({ id: Number.NaN })).toBeNull();
    expect(adapter.extrairIdExterno({ id: Number.POSITIVE_INFINITY })).toBeNull();
    expect(adapter.extrairIdExterno({ id: '   ' })).toBeNull();
  });

  it('trata quantidade zero, strings não numéricas e preços negativos ou zerados', () => {
    const itens = adapter.extrairItens({
      items: [
        { name: 'X-Zero', quantity: 0, price: 10 },
        { name: 'X-Neg', quantity: -2, price: 10 },
        { name: 'X-Vazio', quantity: '   ', price: 10 },
        { name: 'X-PrecoNeg', quantity: 1, price: -10 },
        { name: 'X-PrecoStrVazia', quantity: 1, price: '  ' },
        { name: 'X-PrecoZero', quantity: 1, price: 0 },
      ],
    });

    expect(itens).toEqual([
      { nome: 'X-PrecoNeg', quantidade: 1, preco: 0 },
      { nome: 'X-PrecoStrVazia', quantidade: 1, preco: 0 },
      { nome: 'X-PrecoZero', quantidade: 1, preco: 0 },
    ]);
  });
});

describe('normalizarNomeProduto', () => {
  it('remove acentos, hífens, pontuações e normaliza espaços para minúsculo', () => {
    expect(normalizarNomeProduto('X-Bacon')).toBe('x bacon');
    expect(normalizarNomeProduto('X Bacon')).toBe('x bacon');
    expect(normalizarNomeProduto('  x---bacon  ')).toBe('x bacon');
    expect(normalizarNomeProduto('Hambúrguer')).toBe('hamburguer');
    expect(normalizarNomeProduto('Hamburguer')).toBe('hamburguer');
    expect(normalizarNomeProduto('Coca-Cola 350ml')).toBe('coca cola 350ml');
    expect(normalizarNomeProduto('Água Mineral')).toBe('agua mineral');
  });

  it('retorna string vazia para entradas nulas, vazias ou não-strings', () => {
    expect(normalizarNomeProduto('')).toBe('');
    expect(normalizarNomeProduto(null as unknown as string)).toBe('');
    expect(normalizarNomeProduto(undefined as unknown as string)).toBe('');
    expect(normalizarNomeProduto(123 as unknown as string)).toBe('');
    expect(normalizarNomeProduto({} as unknown as string)).toBe('');
  });
});
