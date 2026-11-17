import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { criarErroAxios } from '../test/render';
import {
  unidadeAlternativa,
  siglaUnidadeBase,
  parsearQuantidadeEntrada,
  parsearCustoEntrada,
  converterQuantidadeParaBase,
  converterCustoParaBase,
  validarLinhasEntrada,
  chaveConteudoEntrada,
  textoConfirmacaoEntrada,
  classificarErroEntrada,
  type LinhaEntradaManual,
} from './entradaManual';

function criarLinha(parcial: Partial<LinhaEntradaManual> = {}): LinhaEntradaManual {
  return {
    id: 'l-1',
    insumoId: 'ins-1',
    quantidadeTexto: '1',
    custoTexto: '',
    modoUnidade: 'BASE',
    buscaInsumo: '',
    filtroCategoria: 'TODOS',
    ...parcial,
  };
}

describe('lib/entradaManual', () => {
  it('identifica unidade alternativa apenas para Gramas (kg) e Mililitros (L)', () => {
    expect(unidadeAlternativa('Gramas')).toEqual({
      siglaBase: 'g',
      siglaAlt: 'kg',
      canonicaAlt: 'KG',
    });
    expect(unidadeAlternativa('Mililitros')).toEqual({
      siglaBase: 'ml',
      siglaAlt: 'L',
      canonicaAlt: 'L',
    });
    expect(unidadeAlternativa('Unidade')).toBeNull();
    expect(unidadeAlternativa('Unidades')).toBeNull();

    expect(siglaUnidadeBase('Gramas')).toBe('g');
    expect(siglaUnidadeBase('Mililitros')).toBe('ml');
    expect(siglaUnidadeBase('Unidade')).toBe('un');
    expect(siglaUnidadeBase('Quilos')).toBe('kg');
    expect(siglaUnidadeBase('Litros')).toBe('L');
    expect(siglaUnidadeBase('Caixa')).toBe('Caixa');
  });

  it('parseia quantidade pt-BR (> 0) e custo opcional (>= 0) corretamente', () => {
    expect(parsearQuantidadeEntrada('1,5')).toBe(1.5);
    expect(parsearQuantidadeEntrada('  1,5  ')).toBe(1.5);
    expect(parsearQuantidadeEntrada('2.25')).toBe(2.25);
    expect(parsearQuantidadeEntrada('0')).toBeNull();
    expect(parsearQuantidadeEntrada('0,0')).toBeNull();
    expect(parsearQuantidadeEntrada('0,00')).toBeNull();
    expect(parsearQuantidadeEntrada('-3')).toBeNull();
    expect(parsearQuantidadeEntrada('')).toBeNull();
    expect(parsearQuantidadeEntrada('   ')).toBeNull();
    expect(parsearQuantidadeEntrada('1e999')).toBeNull();

    const validacaoZero = validarLinhasEntrada(
      [criarLinha({ id: 'l-zero', insumoId: 'ins-1', quantidadeTexto: '0' })],
      new Map([['ins-1', { id: 'ins-1', unidade: 'Unidade' }]]),
      '',
    );
    expect(validacaoZero.valido).toBe(false);
    expect(validacaoZero.erros.porLinha['l-zero']?.quantidade).toBe(
      'Informe uma quantidade maior que zero.',
    );

    expect(parsearCustoEntrada('')).toEqual({ valido: true, valor: undefined });
    expect(parsearCustoEntrada('   ')).toEqual({ valido: true, valor: undefined });
    expect(parsearCustoEntrada('0')).toEqual({ valido: true, valor: 0 });
    expect(parsearCustoEntrada('0,00')).toEqual({ valido: true, valor: 0 });
    expect(parsearCustoEntrada('34,90')).toEqual({ valido: true, valor: 34.9 });
    expect(parsearCustoEntrada('  34,90  ')).toEqual({ valido: true, valor: 34.9 });
    expect(parsearCustoEntrada('-0,01')).toEqual({
      valido: false,
      valor: undefined,
      motivo: 'negativo',
    });
    expect(parsearCustoEntrada('-Infinity')).toEqual({
      valido: false,
      valor: undefined,
      motivo: 'invalido',
    });
    expect(parsearCustoEntrada('abc')).toEqual({
      valido: false,
      valor: undefined,
      motivo: 'invalido',
    });
    expect(parsearCustoEntrada('5.000')).toEqual({
      valido: false,
      valor: undefined,
      motivo: 'invalido',
    });
    expect(parsearCustoEntrada('1.234,56')).toEqual({
      valido: false,
      valor: undefined,
      motivo: 'invalido',
    });
  });

  it('recusa padrão de milhar na quantidade ("5.000", "1.500", "10.000") e diferencia custo inválido de negativo', () => {
    expect(parsearQuantidadeEntrada('5.000')).toBeNull();
    expect(parsearQuantidadeEntrada('1.500')).toBeNull();
    expect(parsearQuantidadeEntrada('10.000')).toBeNull();

    const mapa = new Map([['ins-1', { id: 'ins-1', unidade: 'Gramas' }]]);

    const milhar = validarLinhasEntrada(
      [criarLinha({ id: 'l-1', insumoId: 'ins-1', quantidadeTexto: '5.000', custoTexto: '1.234,56' })],
      mapa,
      '',
    );
    expect(milhar.valido).toBe(false);
    expect(milhar.erros.porLinha['l-1']).toEqual({
      quantidade: 'Para 5 mil, digite 5000 (use vírgula só para decimais)',
      custo: 'Valor inválido',
    });

    const negativo = validarLinhasEntrada(
      [criarLinha({ id: 'l-1', insumoId: 'ins-1', quantidadeTexto: '100', custoTexto: '-5' })],
      mapa,
      '',
    );
    expect(negativo.valido).toBe(false);
    expect(negativo.erros.porLinha['l-1']).toEqual({
      custo: 'O custo unitário não pode ser negativo.',
    });
  });

  it('converte quantidade e custo entre kg/g e L/ml com texto explicativo', () => {
    expect(converterQuantidadeParaBase(5, 'Gramas', 'ALTERNATIVA')).toEqual({
      quantidadeBase: 5000,
      fator: 1000,
      textoEquivalencia: 'equivale a 5000 g',
    });
    expect(converterQuantidadeParaBase(1.5, 'Mililitros', 'ALTERNATIVA')).toEqual({
      quantidadeBase: 1500,
      fator: 1000,
      textoEquivalencia: 'equivale a 1500 ml',
    });
    expect(converterQuantidadeParaBase(1.2555, 'Gramas', 'ALTERNATIVA')).toEqual({
      quantidadeBase: 1255.5,
      fator: 1000,
      textoEquivalencia: 'equivale a 1255,5 g',
    });
    expect(converterQuantidadeParaBase(1.5, 'Gramas', 'BASE')).toEqual({
      quantidadeBase: 1.5,
      fator: 1,
      textoEquivalencia: null,
    });

    expect(converterCustoParaBase(34.9, 'Gramas', 'ALTERNATIVA')).toEqual({
      custoBase: 0.0349,
      textoConversaoCusto: 'R$ 34,90/kg = R$ 0,0349/g',
    });
    expect(converterCustoParaBase(0.0349, 'Gramas', 'BASE')).toEqual({
      custoBase: 0.0349,
      textoConversaoCusto: 'R$ 34,90/kg = R$ 0,0349/g',
    });
    expect(converterCustoParaBase(0, 'Gramas', 'ALTERNATIVA')).toEqual({
      custoBase: 0,
      textoConversaoCusto: null,
    });
    expect(converterCustoParaBase(0, 'Gramas', 'BASE')).toEqual({
      custoBase: 0,
      textoConversaoCusto: null,
    });
    expect(converterCustoParaBase(2.5, 'Unidade', 'BASE')).toEqual({
      custoBase: 2.5,
      textoConversaoCusto: null,
    });
    expect(converterCustoParaBase(undefined, 'Gramas', 'ALTERNATIVA')).toEqual({
      custoBase: undefined,
      textoConversaoCusto: null,
    });
  });

  it('valida lista vazia, > 100 itens, observação > 500, duplicado, quantidade <= 0 e custo < 0', () => {
    const mapa = new Map([
      ['ins-1', { id: 'ins-1', unidade: 'Gramas' }],
      ['ins-2', { id: 'ins-2', unidade: 'Unidade' }],
    ]);

    const vazio = validarLinhasEntrada([], mapa, '');
    expect(vazio.valido).toBe(false);
    expect(vazio.erros.geral).toBe('Adicione pelo menos um item para registrar a entrada.');

    const semInsumo = validarLinhasEntrada(
      [criarLinha({ id: 'l-sem', insumoId: '', quantidadeTexto: '2' })],
      mapa,
      '',
    );
    expect(semInsumo.valido).toBe(false);
    expect(semInsumo.erros.porLinha['l-sem']).toEqual({ insumoId: 'Selecione um insumo.' });

    const obsNoLimite = validarLinhasEntrada(
      [
        criarLinha({
          id: 'l-ok-1',
          insumoId: 'ins-1',
          quantidadeTexto: '  2,5  ',
          modoUnidade: 'ALTERNATIVA',
          custoTexto: '34,90',
        }),
        criarLinha({
          id: 'l-ok-2',
          insumoId: 'ins-2',
          quantidadeTexto: '6',
          modoUnidade: 'BASE',
          custoTexto: '',
        }),
      ],
      mapa,
      `  ${'a'.repeat(500)}  `,
    );
    expect(obsNoLimite.valido).toBe(true);
    expect(obsNoLimite.erros.observacao).toBeUndefined();
    expect(obsNoLimite.itensPayload).toEqual([
      { insumoId: 'ins-1', quantidade: 2500, custoUnitario: 0.0349 },
      { insumoId: 'ins-2', quantidade: 6 },
    ]);
    expect('custoUnitario' in obsNoLimite.itensPayload[1]).toBe(false);

    const obsLonga = validarLinhasEntrada([criarLinha()], mapa, 'a'.repeat(501));
    expect(obsLonga.valido).toBe(false);
    expect(obsLonga.erros.observacao).toMatch(/500 caracteres/);

    const duplicadoEInvalido = validarLinhasEntrada(
      [
        criarLinha({ id: 'l-1', insumoId: 'ins-1', quantidadeTexto: '0', custoTexto: '-5' }),
        criarLinha({ id: 'l-2', insumoId: 'ins-1', quantidadeTexto: '2', custoTexto: '' }),
      ],
      mapa,
      'Teste',
    );
    expect(duplicadoEInvalido.valido).toBe(false);
    expect(duplicadoEInvalido.erros.porLinha['l-1']).toEqual({
      quantidade: 'Informe uma quantidade maior que zero.',
      custo: 'O custo unitário não pode ser negativo.',
    });
    expect(duplicadoEInvalido.erros.porLinha['l-2'].insumoId).toBe(
      'Este insumo já foi incluído na entrada.',
    );

    const cemItens = Array.from({ length: 100 }, (_, idx) =>
      criarLinha({ id: `l-${idx}`, insumoId: idx === 0 ? 'ins-1' : 'ins-2' }),
    );
    expect(validarLinhasEntrada(cemItens, mapa, '').erros.geral).toBeUndefined();

    const cemMaisUm = Array.from({ length: 101 }, (_, idx) =>
      criarLinha({ id: `l-${idx}`, insumoId: idx === 0 ? 'ins-1' : 'ins-2' }),
    );
    expect(validarLinhasEntrada(cemMaisUm, mapa, '').erros.geral).toMatch(/100 itens/);
  });

  it('gera chave de conteúdo determinística e texto de confirmação singular/plural', () => {
    const c1 = chaveConteudoEntrada('  Nota Atacadão ', [{ insumoId: 'ins-1', quantidade: 1500 }]);
    const c2 = chaveConteudoEntrada('Nota Atacadão', [{ insumoId: 'ins-1', quantidade: 1500 }]);
    const c3 = chaveConteudoEntrada('Nota Atacadão', [{ insumoId: 'ins-1', quantidade: 1501 }]);
    expect(c1).toBe(c2);
    expect(c1).not.toBe(c3);

    expect(textoConfirmacaoEntrada(1)).toBe('Dar entrada de 1 item? O estoque será aumentado.');
    expect(textoConfirmacaoEntrada(3)).toBe('Dar entrada de 3 itens? O estoque será aumentado.');
    expect(textoConfirmacaoEntrada([])).toBe('Dar entrada de 0 itens? O estoque será aumentado.');
    expect(
      textoConfirmacaoEntrada([{ nome: 'Pão Brioche', quantidade: 10, unidade: 'Unidade' }]),
    ).toBe('Dar entrada de 1 item? O estoque será aumentado.\nPão Brioche: +10 un');

    const resumoDetalhado = textoConfirmacaoEntrada([
      { nome: 'Carne de Hambúrguer', quantidade: 5000, unidade: 'Gramas' },
      { nome: 'Coca Cola Zero 350ml', quantidade: 24, unidade: 'Unidade' },
    ]);
    expect(resumoDetalhado).toContain('Dar entrada de 2 itens? O estoque será aumentado.');
    expect(resumoDetalhado).toContain('Carne de Hambúrguer: +5.000 g');
    expect(resumoDetalhado).toContain('Coca Cola Zero 350ml: +24 un');
  });

  it('classifica erros 404 (apontando o insumo), 409, 400 e falha de rede/5xx', () => {
    const selecionados = [
      { id: 'ins-1', nome: 'Carne de Hambúrguer' },
      { id: 'ins-2', nome: 'Pão Brioche' },
    ];

    const erro404 = classificarErroEntrada(
      criarErroAxios(404, { message: 'Insumo(s) não encontrado(s): ins-2' }),
      selecionados,
    );
    expect(erro404.tipo).toBe('nao_encontrado');
    expect(erro404.mensagem).toContain('Pão Brioche');
    expect(erro404.mensagem).not.toContain('Carne de Hambúrguer');

    const erro404PorNome = classificarErroEntrada(
      criarErroAxios(404, { message: 'Item CARNE DE HAMBÚRGUER não existe' }),
      selecionados,
    );
    expect(erro404PorNome.mensagem).toContain('Carne de Hambúrguer');
    expect(erro404PorNome.mensagem).not.toContain('Pão Brioche');

    const erro404FallbackLista = classificarErroEntrada(
      criarErroAxios(404, {}),
      selecionados,
    );
    expect(erro404FallbackLista.mensagem).toContain('Carne de Hambúrguer, Pão Brioche');
    expect(erro404FallbackLista.mensagem).toContain('Insumo não encontrado.');

    const erro404ListaVazia = classificarErroEntrada(
      criarErroAxios(404, {}),
      [],
    );
    expect(erro404ListaVazia).toEqual({
      tipo: 'nao_encontrado',
      mensagem: 'Insumo não encontrado.',
    });

    const erro409 = classificarErroEntrada(
      criarErroAxios(409, { message: 'Conflito de chave' }),
      selecionados,
    );
    expect(erro409.tipo).toBe('conflito');
    expect(erro409.mensagem).toMatch(/confira o estoque/i);

    const erro400 = classificarErroEntrada(
      criarErroAxios(400, { message: 'Informe ao menos um item' }),
      selecionados,
    );
    expect(erro400).toEqual({ tipo: 'validacao', mensagem: 'Informe ao menos um item' });

    const erro400Vazio = classificarErroEntrada(criarErroAxios(400, {}), selecionados);
    expect(erro400Vazio).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a entrada manual.',
    });

    const erroGenerico = classificarErroEntrada(new Error('Falha local'), selecionados);
    expect(erroGenerico).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a entrada manual.',
    });
    expect(classificarErroEntrada({}, selecionados)).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a entrada manual.',
    });

    const erroRede = classificarErroEntrada(
      new axios.AxiosError('Network Error', 'ERR_NETWORK'),
      selecionados,
    );
    expect(erroRede.tipo).toBe('rede');
    expect(erroRede.mensagem).toMatch(/mesma chave será usada/i);

    const erro500 = classificarErroEntrada(criarErroAxios(500, { message: 'Erro interno' }), selecionados);
    expect(erro500.tipo).toBe('rede');
    expect(erro500.mensagem).toMatch(/mesma chave será usada/i);
  });
});
