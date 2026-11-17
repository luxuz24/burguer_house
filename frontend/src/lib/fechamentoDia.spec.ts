import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { criarErroAxios } from '../test/render';
import {
  agruparImpacto,
  fechamentosAtivos,
  formatarHoraLoja,
  normalizarListagem,
  textoAvisoDiaJaFechado,
  textoItensFechamento,
  type FechamentoListado,
  classificarErroConfirmacao,
  formatarDiaCurto,
  textoConfirmacaoBaixa,
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

  describe('texto e erros da confirmação', () => {
    it('formatarDiaCurto mostra DD/MM e tolera texto fora do formato', () => {
      expect(formatarDiaCurto('2026-11-13')).toBe('13/11');
      expect(formatarDiaCurto('lixo')).toBe('lixo');
    });

    it('textoConfirmacaoBaixa informa unidades e dia, e avisa quando algum insumo ficará negativo', () => {
      expect(textoConfirmacaoBaixa(8, '2026-11-13', false)).toBe('Dar baixa de 8 itens do dia 13/11? O estoque será reduzido.');
      expect(textoConfirmacaoBaixa(1, '2026-11-13', false)).toBe('Dar baixa de 1 item do dia 13/11? O estoque será reduzido.');
      expect(textoConfirmacaoBaixa(2, '2026-11-13', true)).toBe(
        'Dar baixa de 2 itens do dia 13/11? O estoque será reduzido. Atenção: algum insumo ficará negativo.',
      );
    });

    it('classificarErroConfirmacao separa 409, 422, falha de rede/5xx e outros', () => {
      expect(classificarErroConfirmacao(criarErroAxios(409, { message: 'x' })).tipo).toBe('conflito');
      const e422 = classificarErroConfirmacao(
        criarErroAxios(422, { message: 'Produtos', produtosSemFicha: [{ produtoId: 'p', nome: 'X-Tudo' }], produtosNaoEncontrados: ['uuid-1'] }),
      );
      expect(e422).toMatchObject({ tipo: 'validacao', produtosSemFicha: ['X-Tudo'], produtosNaoEncontrados: ['uuid-1'] });
      expect(classificarErroConfirmacao(new axios.AxiosError('Network Error', 'ERR_NETWORK')).tipo).toBe('rede');
      expect(classificarErroConfirmacao(criarErroAxios(503, { message: 'fora' })).tipo).toBe('rede');
      expect(classificarErroConfirmacao(criarErroAxios(400, { message: 'Data inválida' }))).toMatchObject({ tipo: 'outro', mensagem: 'Data inválida' });
      expect(classificarErroConfirmacao(new Error('boom')).tipo).toBe('outro');
    });
  });

  describe('lançamentos do dia (tarefa 14)', () => {
    const fech = (o: Partial<FechamentoListado> = {}): FechamentoListado => ({
      id: 'v1', externalId: 'manual:a', criadoEm: '2026-11-13T22:41:00.000Z', ocorridoEm: '2026-11-13T16:00:00.000Z',
      observacao: null, itens: [{ nome: 'BACON HOUSE', quantidade: 2 }], usuario: { id: 'u', nome: 'Carlos' },
      estornada: false, estorno: null, ...o,
    });

    it('formatarHoraLoja usa o fuso America/Campo_Grande e tolera data inválida', () => {
      expect(formatarHoraLoja('2026-11-13T22:41:00.000Z')).toBe('18:41');
      expect(formatarHoraLoja('2026-11-13T02:05:00.000Z')).toBe('22:05');
      expect(formatarHoraLoja('lixo')).toBe('—');
    });

    it('textoItensFechamento junta os itens com "×" e separador', () => {
      expect(textoItensFechamento([{ nome: 'BACON HOUSE', quantidade: 2 }, { nome: 'Coca Cola Zero 350ml', quantidade: 6 }])).toBe(
        '2× BACON HOUSE · 6× Coca Cola Zero 350ml',
      );
      expect(textoItensFechamento([])).toBe('Sem itens');
    });

    it('fechamentosAtivos descarta os estornados', () => {
      expect(fechamentosAtivos([fech({ id: 'a' }), fech({ id: 'b', estornada: true })]).map((f) => f.id)).toEqual(['a']);
    });

    it('textoAvisoDiaJaFechado conta fechamentos e unidades, no singular e no plural, e é vazio sem ativos', () => {
      expect(textoAvisoDiaJaFechado([])).toBeNull();
      expect(textoAvisoDiaJaFechado([fech({ itens: [{ nome: 'A', quantidade: 1 }, { nome: 'B', quantidade: 1 }] })])).toBe(
        'Este dia já tem 1 fechamento (2 itens). Lançar outro soma ao anterior.',
      );
      expect(textoAvisoDiaJaFechado([fech({ itens: [{ nome: 'A', quantidade: 1 }] })])).toBe(
        'Este dia já tem 1 fechamento (1 item). Lançar outro soma ao anterior.',
      );
      expect(textoAvisoDiaJaFechado([fech(), fech({ id: 'x', itens: [{ nome: 'C', quantidade: 3 }] })])).toBe(
        'Este dia já tem 2 fechamentos (5 itens). Lançar outro soma aos anteriores.',
      );
    });

    it('normalizarListagem aceita o contrato e trata resposta fora do formato como lista vazia', () => {
      const ok = normalizarListagem({ data: '2026-11-13', total: 1, fechamentos: [fech()] });
      expect(ok.fechamentos).toHaveLength(1);
      expect(normalizarListagem([]).fechamentos).toEqual([]);
      expect(normalizarListagem(null).fechamentos).toEqual([]);
      const parcial = normalizarListagem({ fechamentos: [{ id: 'x' }, null, 5] });
      expect(parcial.fechamentos).toEqual([
        { id: 'x', externalId: null, criadoEm: '', ocorridoEm: '', observacao: null, itens: [], usuario: null, estornada: false, estorno: null },
      ]);
    });
  });
});
