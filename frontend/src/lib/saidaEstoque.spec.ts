import { describe, it, expect } from 'vitest';
import { totalItensQueSairam } from './saidaEstoque';

describe('lib/saidaEstoque', () => {
  it('soma os itens quando a lista de mais vendidos está completa', () => {
    expect(totalItensQueSairam([{ quantidadeVendida: 18 }, { quantidadeVendida: 9 }, { quantidadeVendida: 3 }])).toBe(30);
  });

  it('lista vazia ou com 10 produtos ou mais (pode estar cortada pelo backend) não gera total', () => {
    expect(totalItensQueSairam([])).toBeNull();
    expect(totalItensQueSairam(Array.from({ length: 9 }, () => ({ quantidadeVendida: 1 })))).toBe(9);
    expect(totalItensQueSairam(Array.from({ length: 10 }, () => ({ quantidadeVendida: 1 })))).toBeNull();
    expect(totalItensQueSairam(Array.from({ length: 12 }, () => ({ quantidadeVendida: 1 })))).toBeNull();
  });

  it('ignora quantidade inválida em vez de contaminar a soma', () => {
    expect(totalItensQueSairam([{ quantidadeVendida: 5 }, { quantidadeVendida: Number.NaN }])).toBe(5);
  });
});
