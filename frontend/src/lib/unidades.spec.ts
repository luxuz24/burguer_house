import { describe, it, expect } from 'vitest';
import { sugerirConversao, normalizarUnidade } from './unidades';

describe('normalizarUnidade', () => {
  it('normaliza variações para unidades canônicas', () => {
    expect(normalizarUnidade('QUILOS')).toBe('KG');
    expect(normalizarUnidade('kilogramas')).toBe('KG');
    expect(normalizarUnidade('g')).toBe('G');
    expect(normalizarUnidade('LITROS')).toBe('L');
    expect(normalizarUnidade('ml')).toBe('ML');
    expect(normalizarUnidade('unidade')).toBe('UN');
    expect(normalizarUnidade('desconhecido')).toBeNull();
  });
});

describe('sugerirConversao', () => {
  it('converte quilogramas para gramas com fator 1000 e sem incerteza', () => {
    expect(sugerirConversao('KG', 'Gramas', 2)).toEqual({
      fator: 1000,
      quantidadeConvertida: 2000,
      conversaoIncerta: false,
    });
    expect(sugerirConversao('KILOGRAMA', 'Gramas', 1)).toEqual({
      fator: 1000,
      quantidadeConvertida: 1000,
      conversaoIncerta: false,
    });
    expect(sugerirConversao('QUILOS', 'G', 0.5)).toEqual({
      fator: 1000,
      quantidadeConvertida: 500,
      conversaoIncerta: false,
    });
  });

  it('converte litros para mililitros com fator 1000 e sem incerteza', () => {
    expect(sugerirConversao('L', 'Mililitros', 1.5)).toEqual({
      fator: 1000,
      quantidadeConvertida: 1500,
      conversaoIncerta: false,
    });
    expect(sugerirConversao('LTS', 'Mililitros', 1)).toEqual({
      fator: 1000,
      quantidadeConvertida: 1000,
      conversaoIncerta: false,
    });
  });

  it('reconhece unidades equivalentes com fator 1 e sem incerteza', () => {
    expect(sugerirConversao('UN', 'Unidade', 5)).toEqual({
      fator: 1,
      quantidadeConvertida: 5,
      conversaoIncerta: false,
    });
    expect(sugerirConversao('QUILOS', 'KG', 10)).toEqual({
      fator: 1,
      quantidadeConvertida: 10,
      conversaoIncerta: false,
    });
  });

  it('marca conversaoIncerta: true para unidades desconhecidas de embalagem', () => {
    expect(sugerirConversao('CX', 'Unidade', 2)).toEqual({
      fator: 1,
      quantidadeConvertida: 2,
      conversaoIncerta: true,
    });
    expect(sugerirConversao('PCT', 'Gramas', 1)).toEqual({
      fator: 1,
      quantidadeConvertida: 1,
      conversaoIncerta: true,
    });
  });
});
