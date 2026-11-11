import { describe, it, expect } from 'vitest';
import { diasDeValidade, tipoAlerta, ordenarAlertas, textoAlertaValidade, listaOuVazia, type AlertaEstoque } from './alertasEstoque';

const base: AlertaEstoque = {
  id: 'x', nome: 'X', unidade: 'Unidades', estoqueAtual: 1, estoqueMinimo: 10, status: 'CRITICO', percentualEstoque: 10,
};

describe('pages/alertasEstoque', () => {
  it('diasDeValidade: número finito ou null (ausente, null, NaN, Infinity, string)', () => {
    expect(diasDeValidade({ diasRestantesValidade: 2 })).toBe(2);
    expect(diasDeValidade({ diasRestantesValidade: 0 })).toBe(0);
    expect(diasDeValidade({ diasRestantesValidade: -3 })).toBe(-3);
    expect(diasDeValidade({})).toBeNull();
    expect(diasDeValidade({ diasRestantesValidade: null })).toBeNull();
    expect(diasDeValidade({ diasRestantesValidade: NaN })).toBeNull();
    expect(diasDeValidade({ diasRestantesValidade: Infinity })).toBeNull();
    expect(diasDeValidade({ diasRestantesValidade: '2' as unknown as number })).toBeNull();
  });

  it('tipoAlerta: tabela de decisão (vencido flag × dias)', () => {
    expect(tipoAlerta({})).toBe('estoque');
    expect(tipoAlerta({ vencido: false })).toBe('estoque');
    expect(tipoAlerta({ vencido: true })).toBe('vencido');
    expect(tipoAlerta({ diasRestantesValidade: 2, vencido: false })).toBe('vencendo');
    expect(tipoAlerta({ diasRestantesValidade: 1 })).toBe('vencendo');
    // limite: 0 já é vencido no backend (diasRestantes <= 0)
    expect(tipoAlerta({ diasRestantesValidade: 0 })).toBe('vencido');
    expect(tipoAlerta({ diasRestantesValidade: -1, vencido: false })).toBe('vencido');
    expect(tipoAlerta({ diasRestantesValidade: 5, vencido: true })).toBe('vencido');
    expect(tipoAlerta({ diasRestantesValidade: null, vencido: null })).toBe('estoque');
  });

  it('ordenarAlertas: vencido, vencendo, estoque; estável dentro do grupo; não muta a entrada', () => {
    const e1 = { ...base, id: 'e1' };
    const e2 = { ...base, id: 'e2' };
    const v = { ...base, id: 'v', diasRestantesValidade: 2 };
    const x = { ...base, id: 'x', vencido: true, diasRestantesValidade: -1 };
    const entrada = [e1, v, e2, x];
    expect(ordenarAlertas(entrada).map((i) => i.id)).toEqual(['x', 'v', 'e1', 'e2']);
    expect(entrada.map((i) => i.id)).toEqual(['e1', 'v', 'e2', 'x']);
    expect(ordenarAlertas([])).toEqual([]);
  });

  it('textoAlertaValidade coerente com o tipo', () => {
    expect(textoAlertaValidade({ diasRestantesValidade: 2 })).toBe('Vence em 2 dias');
    expect(textoAlertaValidade({ diasRestantesValidade: 1 })).toBe('Vence amanhã');
    expect(textoAlertaValidade({ diasRestantesValidade: 0 })).toBe('Vencido');
    expect(textoAlertaValidade({ vencido: true })).toBe('Vencido');
    expect(textoAlertaValidade({ diasRestantesValidade: -4 })).toBe('Vencido');
  });

  it('listaOuVazia', () => {
    expect(listaOuVazia([1, 2])).toEqual([1, 2]);
    expect(listaOuVazia(undefined)).toEqual([]);
    expect(listaOuVazia(null)).toEqual([]);
    expect(listaOuVazia('abc')).toEqual([]);
    expect(listaOuVazia({ length: 1 })).toEqual([]);
  });
});
