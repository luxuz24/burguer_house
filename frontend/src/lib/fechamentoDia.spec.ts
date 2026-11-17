import { describe, it, expect } from 'vitest';
import {
  agruparImpacto,
  chaveSimulacao,
  ehProdutoInterno,
  filtrarProdutosVendaveis,
  itensParaSimulacao,
  limitarQuantidade,
  resumoFechamento,
  type ConsumoSimulacao,
} from './fechamentoDia';

const consumo = (o: Partial<ConsumoSimulacao> & Pick<ConsumoSimulacao, 'insumoId' | 'nome' | 'categoria'>): ConsumoSimulacao => ({
  unidade: 'Unidade', consumo: 1, estoqueAtual: 10, estoqueProjetado: 9, ficariaNegativo: false, ...o,
});

describe('lib/fechamentoDia', () => {
  describe('produtos internos (PRODUÇÃO:)', () => {
    it('reconhece o prefixo ignorando caixa, acento e espaços, e não confunde nomes comuns', () => {
      expect(ehProdutoInterno('PRODUÇÃO: Maionese da Casa')).toBe(true);
      expect(ehProdutoInterno('  producao :  Molho')).toBe(true);
      expect(ehProdutoInterno('Produção própria de X-Bacon')).toBe(false);
      expect(ehProdutoInterno('X-Bacon House')).toBe(false);
      expect(ehProdutoInterno('')).toBe(false);
    });

    it('filtrarProdutosVendaveis remove só os internos e mantém a ordem', () => {
      const lista = [
        { id: '1', nome: 'X-Bacon' },
        { id: '2', nome: 'PRODUÇÃO: Maionese' },
        { id: '3', nome: 'Coca Zero' },
      ];
      expect(filtrarProdutosVendaveis(lista).map((p) => p.id)).toEqual(['1', '3']);
    });
  });

  describe('limitarQuantidade', () => {
    it('trunca para inteiro entre 0 e 500 e trata lixo como 0', () => {
      expect(limitarQuantidade(7.9)).toBe(7);
      expect(limitarQuantidade(-3)).toBe(0);
      expect(limitarQuantidade(999)).toBe(500);
      expect(limitarQuantidade(500)).toBe(500);
      expect(limitarQuantidade(Number.NaN)).toBe(0);
      expect(limitarQuantidade('12')).toBe(12);
      expect(limitarQuantidade('12abc')).toBe(12);
      expect(limitarQuantidade('abc')).toBe(0);
      expect(limitarQuantidade('')).toBe(0);
      expect(limitarQuantidade(undefined)).toBe(0);
    });
  });

  describe('resumo e itens', () => {
    it('conta produtos e unidades só das quantidades maiores que zero', () => {
      expect(resumoFechamento({ a: 2, b: 0, c: 3 })).toEqual({ produtos: 2, unidades: 5 });
      expect(resumoFechamento({})).toEqual({ produtos: 0, unidades: 0 });
    });

    it('itensParaSimulacao envia só os itens com quantidade maior que zero', () => {
      expect(itensParaSimulacao({ a: 2, b: 0, c: 3 })).toEqual([
        { produtoId: 'a', quantidade: 2 },
        { produtoId: 'c', quantidade: 3 },
      ]);
    });

    it('chaveSimulacao muda com data ou quantidade e ignora zeros e a ordem das chaves', () => {
      const base = chaveSimulacao('2026-11-13', { a: 2, b: 1 });
      expect(chaveSimulacao('2026-11-13', { b: 1, a: 2, c: 0 })).toBe(base);
      expect(chaveSimulacao('2026-11-12', { a: 2, b: 1 })).not.toBe(base);
      expect(chaveSimulacao('2026-11-13', { a: 3, b: 1 })).not.toBe(base);
    });
  });

  describe('agruparImpacto', () => {
    it('separa os que ficariam negativos e agrupa o resto por categoria na ordem Ingredientes, Embalagens, Bebidas', () => {
      const consumos = [
        consumo({ insumoId: 'n1', nome: 'Carne', categoria: 'INGREDIENTE', ficariaNegativo: true, estoqueProjetado: -5 }),
        consumo({ insumoId: 'b1', nome: 'Coca', categoria: 'BEBIDA' }),
        consumo({ insumoId: 'e1', nome: 'Saco', categoria: 'EMBALAGEM' }),
        consumo({ insumoId: 'i1', nome: 'Pão', categoria: 'INGREDIENTE' }),
      ];
      const r = agruparImpacto(consumos);
      expect(r.negativos.map((c) => c.insumoId)).toEqual(['n1']);
      expect(r.grupos.map((g) => [g.rotulo, g.itens.map((c) => c.insumoId)])).toEqual([
        ['Ingredientes', ['i1']],
        ['Embalagens', ['e1']],
        ['Bebidas', ['b1']],
      ]);
    });

    it('omite categorias vazias e trata categoria desconhecida como Ingredientes', () => {
      const r = agruparImpacto([consumo({ insumoId: 'x', nome: 'X', categoria: 'OUTRA' as never })]);
      expect(r.negativos).toEqual([]);
      expect(r.grupos.map((g) => g.rotulo)).toEqual(['Ingredientes']);
    });
  });
});
