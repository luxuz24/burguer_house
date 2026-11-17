import { describe, it, expect } from 'vitest';
import {
  totalItensQueSairam,
  pedidosManuais,
  textoPedidosManuaisRelatorio,
  textoPedidosManuaisInicio,
} from './saidaEstoque';

describe('lib/saidaEstoque - pedidos do fechamento manual (tarefa 17)', () => {
  it('lê kpis.vendasManuaisQtd; campo ausente (backend antigo), nulo ou inválido conta como 0', () => {
    expect(pedidosManuais({ vendasManuaisQtd: 18 })).toBe(18);
    expect(pedidosManuais({})).toBe(0);
    expect(pedidosManuais(null)).toBe(0);
    expect(pedidosManuais(undefined)).toBe(0);
    expect(pedidosManuais({ vendasManuaisQtd: 0 })).toBe(0);
    expect(pedidosManuais({ vendasManuaisQtd: -3 })).toBe(0);
    expect(pedidosManuais({ vendasManuaisQtd: Number.NaN })).toBe(0);
    expect(pedidosManuais({ vendasManuaisQtd: '7' })).toBe(0);
  });

  it('texto de apoio dos Relatórios em pt-BR, no singular quando é 1', () => {
    expect(textoPedidosManuaisRelatorio(18)).toBe('18 lançados no fechamento do dia');
    expect(textoPedidosManuaisRelatorio(1)).toBe('1 lançado no fechamento do dia');
    expect(textoPedidosManuaisRelatorio(1206)).toBe('1.206 lançados no fechamento do dia');
  });

  it('texto de apoio do Início em pt-BR, no singular quando é 1', () => {
    expect(textoPedidosManuaisInicio(3)).toBe('inclui 3 pedidos lançados à mão');
    expect(textoPedidosManuaisInicio(1)).toBe('inclui 1 pedido lançado à mão');
  });
});

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
