import { describe, it, expect } from 'vitest';
import { fatorPerdaSeguro } from './fator_perda.js';

describe('fatorPerdaSeguro', () => {
  it('retorna 0 para valores negativos, zero, nulos ou não finitos', () => {
    expect(fatorPerdaSeguro(-0.05)).toBe(0);
    expect(fatorPerdaSeguro(0)).toBe(0);
    expect(fatorPerdaSeguro(-0)).toBe(0);
    expect(fatorPerdaSeguro(null)).toBe(0);
    expect(fatorPerdaSeguro(undefined)).toBe(0);
    expect(fatorPerdaSeguro(NaN)).toBe(0);
    expect(fatorPerdaSeguro(Infinity)).toBe(0);
    expect(fatorPerdaSeguro(-Infinity)).toBe(0);
  });

  it('preserva fator de perda positivo', () => {
    expect(fatorPerdaSeguro(0.1)).toBe(0.1);
    expect(fatorPerdaSeguro(0.0001)).toBe(0.0001);
  });
});
