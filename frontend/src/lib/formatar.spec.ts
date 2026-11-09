import { describe, it, expect } from 'vitest';
import { formatarMoeda, formatarQuantidade, formatarPercentual } from './formatar';

describe('lib/formatar - Utilitários de Formatação pt-BR', () => {
  describe('formatarMoeda', () => {
    it('formata valores inteiros e decimais com separadores pt-BR (ponto para milhar, virgula para centavos)', () => {
      // O Intl insere non-breaking space (char 160) entre "R$" e o número
      const resultadoMilhar = formatarMoeda(1234.5);
      expect(resultadoMilhar.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,50');

      const resultadoDezena = formatarMoeda(25);
      expect(resultadoDezena.replace(/\u00a0/g, ' ')).toBe('R$ 25,00');

      const resultadoCentavos = formatarMoeda(0.08);
      expect(resultadoCentavos.replace(/\u00a0/g, ' ')).toBe('R$ 0,08');
    });

    it('formata zero legitimamente como R$ 0,00', () => {
      expect(formatarMoeda(0).replace(/\u00a0/g, ' ')).toBe('R$ 0,00');
    });

    it('retorna traço em-dash (—) para valores nulos, indefinidos, NaN ou infinitos (🟡 3)', () => {
      expect(formatarMoeda(null)).toBe('—');
      expect(formatarMoeda(undefined)).toBe('—');
      expect(formatarMoeda(NaN)).toBe('—');
      expect(formatarMoeda(Infinity)).toBe('—');
      expect(formatarMoeda(-Infinity)).toBe('—');
    });

    it('formata valores negativos com sinal', () => {
      const negativo = formatarMoeda(-50.75);
      expect(negativo.replace(/\u00a0/g, ' ')).toContain('-R$ 50,75');
    });
  });

  describe('formatarQuantidade', () => {
    it('formata quantidades com separador de milhar e unidade opcional', () => {
      expect(formatarQuantidade(1500, 'g')).toBe('1.500 g');
      expect(formatarQuantidade(2500000, 'ml')).toBe('2.500.000 ml');
      expect(formatarQuantidade(12)).toBe('12');
      expect(formatarQuantidade(2.5, 'kg')).toBe('2,5 kg');
      expect(formatarQuantidade(0, 'un')).toBe('0 un');
    });

    it('respeita parametro de casas decimais fixas quando fornecido', () => {
      expect(formatarQuantidade(2.5, 'kg', 2)).toBe('2,50 kg');
      expect(formatarQuantidade(10, 'un', 0)).toBe('10 un');
    });

    it('retorna traço em-dash (—) para valores invalidos ou nulos (🟡 3)', () => {
      expect(formatarQuantidade(null, 'g')).toBe('—');
      expect(formatarQuantidade(undefined)).toBe('—');
      expect(formatarQuantidade(NaN, 'un')).toBe('—');
      expect(formatarQuantidade(Infinity)).toBe('—');
    });
  });

  describe('formatarPercentual', () => {
    it('formata percentual a partir de fracao (0 a 1)', () => {
      expect(formatarPercentual(0.155)).toBe('15,5%');
      expect(formatarPercentual(0.05)).toBe('5%');
      expect(formatarPercentual(1)).toBe('100%');
      expect(formatarPercentual(0)).toBe('0%');
    });

    it('formata percentual a partir de base cem (quando baseCem=true)', () => {
      expect(formatarPercentual(15.5, true)).toBe('15,5%');
      expect(formatarPercentual(100, true)).toBe('100%');
    });

    it('retorna traço em-dash (—) para valores invalidos ou nulos (🟡 3)', () => {
      expect(formatarPercentual(null)).toBe('—');
      expect(formatarPercentual(undefined)).toBe('—');
      expect(formatarPercentual(NaN)).toBe('—');
      expect(formatarPercentual(Infinity)).toBe('—');
    });
  });
});
