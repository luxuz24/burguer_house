import { describe, it, expect } from 'vitest';
import { normalizarNomeProduto } from './nomes.js';

describe('normalizarNomeProduto', () => {
  it('remove acentos, simbolos e converte para minusculas com espacos simples', () => {
    expect(normalizarNomeProduto('X-Bacon')).toBe('x bacon');
    expect(normalizarNomeProduto('X Bacon')).toBe('x bacon');
    expect(normalizarNomeProduto('  x---bacon  ')).toBe('x bacon');
    expect(normalizarNomeProduto('Hambúrguer Artesanal!')).toBe('hamburguer artesanal');
    expect(normalizarNomeProduto('Coca-Cola 350ml')).toBe('coca cola 350ml');
  });

  it('retorna string vazia para entradas nulas ou vazias', () => {
    expect(normalizarNomeProduto('')).toBe('');
    expect(normalizarNomeProduto(null as unknown as string)).toBe('');
    expect(normalizarNomeProduto(undefined as unknown as string)).toBe('');
  });
});
