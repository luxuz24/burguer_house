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

describe('unidades - limites e paridade com o backend (xml_parser.service.ts)', () => {
  it('converte no sentido inverso: G→KG e ML→L com fator 0,001', () => {
    expect(sugerirConversao('G', 'KG', 500)).toEqual({ fator: 0.001, quantidadeConvertida: 0.5, conversaoIncerta: false });
    expect(sugerirConversao('ML', 'L', 250)).toEqual({ fator: 0.001, quantidadeConvertida: 0.25, conversaoIncerta: false });
  });

  it('grandezas incompatíveis ficam 1:1 com incerteza (UN→Gramas, KG→Litros)', () => {
    expect(sugerirConversao('UN', 'Gramas', 3)).toEqual({ fator: 1, quantidadeConvertida: 3, conversaoIncerta: true });
    expect(sugerirConversao('KG', 'Litros', 2)).toEqual({ fator: 1, quantidadeConvertida: 2, conversaoIncerta: true });
  });

  it('ignora caixa e espaços; vazio não é unidade', () => {
    expect(normalizarUnidade('  kg ')).toBe('KG');
    expect(normalizarUnidade('')).toBeNull();
    expect(normalizarUnidade('   ')).toBeNull();
    expect(sugerirConversao('', '', 4)).toEqual({ fator: 1, quantidadeConvertida: 4, conversaoIncerta: true });
  });

  it('quantidade omitida vale 1; zero e negativo passam adiante sem mudar o fator (validação é da tela)', () => {
    expect(sugerirConversao('KG', 'G')).toEqual({ fator: 1000, quantidadeConvertida: 1000, conversaoIncerta: false });
    expect(sugerirConversao('KG', 'G', 0)).toEqual({ fator: 1000, quantidadeConvertida: 0, conversaoIncerta: false });
    expect(sugerirConversao('L', 'ML', -1)).toEqual({ fator: 1000, quantidadeConvertida: -1000, conversaoIncerta: false });
  });

  it('extremos: valores grandes e frações pequenas mantêm a mesma conta do backend (ponto flutuante)', () => {
    expect(sugerirConversao('KG', 'G', 1e9).quantidadeConvertida).toBe(1e12);
    expect(sugerirConversao('G', 'KG', 3).quantidadeConvertida).toBe(3 * 0.001);
  });
});
