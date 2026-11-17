import { describe, it, expect } from 'vitest';
import axios from 'axios';
import {
  MAX_ITENS_CONTAGEM,
  SUGESTOES_MOTIVO_CONTAGEM,
  calcularPreviaItemContagem,
  chaveConteudoContagem,
  classificarErroContagem,
  formatarDiferencaContagem,
  parsearSaldoContado,
  textoConfirmacaoContagem,
  validarContagemEstoque,
} from './contagemEstoque';
import { criarErroAxios } from '../test/render';

describe('lib/contagemEstoque', () => {
  it('aceita zero e decimais pt-BR no saldo contado, e recusa milhar e negativos', () => {
    expect(parsearSaldoContado('')).toEqual({ estado: 'vazio', valor: null });
    expect(parsearSaldoContado('   ')).toEqual({ estado: 'vazio', valor: null });

    expect(parsearSaldoContado('0')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('  00  ')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('0,0')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('0,00')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('25')).toEqual({ estado: 'valido', valor: 25 });
    expect(parsearSaldoContado('3,2')).toEqual({ estado: 'valido', valor: 3.2 });

    expect(parsearSaldoContado('abc')).toEqual({
      estado: 'invalido',
      valor: null,
      erro: 'Valor inválido',
    });
    expect(parsearSaldoContado('0abc')).toEqual({
      estado: 'invalido',
      valor: null,
      erro: 'Valor inválido',
    });
    expect(parsearSaldoContado('abc0')).toEqual({
      estado: 'invalido',
      valor: null,
      erro: 'Valor inválido',
    });

    expect(parsearSaldoContado('5.000')).toEqual({
      estado: 'milhar',
      valor: null,
      erro: 'Para 5 mil, digite 5000 (use vírgula só para decimais)',
    });
    expect(parsearSaldoContado('1.500')).toEqual({
      estado: 'milhar',
      valor: null,
      erro: 'Para 5 mil, digite 5000 (use vírgula só para decimais)',
    });

    const neg = parsearSaldoContado('-1');
    expect(neg).toEqual({
      estado: 'negativo',
      valor: null,
      erro: 'O saldo contado não pode ser negativo.',
    });

    const negDec = parsearSaldoContado('-0,5');
    expect(negDec.estado).toBe('negativo');
    expect(negDec.valor).toBeNull();

    expect(SUGESTOES_MOTIVO_CONTAGEM).toEqual([
      'Contagem inicial',
      'Contagem semanal',
      'Contagem mensal',
    ]);
  });

  it('converte kg -> g e calcula diferença prevista com sinal e cor semântica', () => {
    expect(formatarDiferencaContagem(15, 'un')).toEqual({ texto: '+15 un', sinal: 'positivo' });
    expect(formatarDiferencaContagem(-800, 'g')).toEqual({ texto: '−800 g', sinal: 'negativo' });
    expect(formatarDiferencaContagem(0, 'un')).toEqual({ texto: 'sem diferença', sinal: 'neutro' });

    const previaVazia = calcularPreviaItemContagem(
      { estoqueAtual: 4000, unidade: 'Gramas' },
      '',
      'BASE',
    );
    expect(previaVazia).toEqual({
      preenchido: false,
      valido: true,
      saldoContadoBase: null,
      textoEquivalencia: null,
      diferenca: null,
      textoDiferenca: null,
      sinalDiferenca: null,
    });

    const previaInvalida = calcularPreviaItemContagem(
      { estoqueAtual: 4000, unidade: 'Gramas' },
      'abc',
      'BASE',
    );
    expect(previaInvalida).toEqual({
      preenchido: true,
      valido: false,
      erro: 'Valor inválido',
      saldoContadoBase: null,
      textoEquivalencia: null,
      diferenca: null,
      textoDiferenca: null,
      sinalDiferenca: null,
    });

    const previaKg = calcularPreviaItemContagem(
      { estoqueAtual: 4000, unidade: 'Gramas' },
      '3,2',
      'ALTERNATIVA',
    );
    expect(previaKg).toEqual({
      preenchido: true,
      valido: true,
      saldoContadoBase: 3200,
      textoEquivalencia: 'equivale a 3200 g',
      diferenca: -800,
      textoDiferenca: '−800 g',
      sinalDiferenca: 'negativo',
    });

    const previaIgual = calcularPreviaItemContagem(
      { estoqueAtual: 10, unidade: 'Unidade' },
      '10',
      'BASE',
    );
    expect(previaIgual.diferenca).toBe(0);
    expect(previaIgual.textoDiferenca).toBe('sem diferença');
    expect(previaIgual.sinalDiferenca).toBe('neutro');
  });

  it('valida lote apenas com itens preenchidos, exige motivo 3..500, até 200 itens e gera confirmação com diferenças', () => {
    const insumos = [
      { id: 'ins-pao', nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 10 },
      { id: 'ins-carne', nome: 'Carne de Hambúrguer', unidade: 'Gramas', estoqueAtual: 4000 },
      { id: 'ins-coca', nome: 'Coca Cola', unidade: 'Unidade', estoqueAtual: 24 },
    ];

    const res = validarContagemEstoque(
      insumos,
      {
        'ins-pao': { texto: '10', modoUnidade: 'BASE' },
        'ins-carne': { texto: '3,2', modoUnidade: 'ALTERNATIVA' },
      },
      'Contagem inicial',
    );
    expect(res.valido).toBe(true);
    expect(res.itensPayload).toEqual([
      { insumoId: 'ins-pao', saldoContado: 10 },
      { insumoId: 'ins-carne', saldoContado: 3200 },
    ]);

    const textoConf = textoConfirmacaoContagem(res.itensResumo);
    expect(textoConf).toBe(
      'Carne de Hambúrguer: 4.000 g → 3.200 g (−800 g)\n1 item sem diferença.\nO servidor recalcula a diferença com o saldo do momento do envio.',
    );

    const textoDoisSemDif = textoConfirmacaoContagem([
      { insumoId: 'ins-pao', nome: 'Pão Brioche', unidade: 'Unidade', saldoAnterior: 10, saldoContado: 10, diferenca: 0 },
      { insumoId: 'ins-coca', nome: 'Coca Cola', unidade: 'Unidade', saldoAnterior: 24, saldoContado: 24, diferenca: 0 },
    ]);
    expect(textoDoisSemDif).toBe(
      '2 itens sem diferença.\nO servidor recalcula a diferença com o saldo do momento do envio.',
    );

    const textoSoDiferenca = textoConfirmacaoContagem([
      { insumoId: 'ins-carne', nome: 'Carne de Hambúrguer', unidade: 'Gramas', saldoAnterior: 4000, saldoContado: 4500, diferenca: 500 },
    ]);
    expect(textoSoDiferenca).toBe(
      'Carne de Hambúrguer: 4.000 g → 4.500 g (+500 g)\nO servidor recalcula a diferença com o saldo do momento do envio.',
    );

    // Motivo no limite exato (3 e 500) e fora dos limites (espacos / 501)
    expect(validarContagemEstoque(insumos, { 'ins-pao': { texto: '5', modoUnidade: 'BASE' } }, ' abc ').valido).toBe(true);
    expect(validarContagemEstoque(insumos, { 'ins-pao': { texto: '5', modoUnidade: 'BASE' } }, 'a'.repeat(500)).valido).toBe(true);

    const motivoLongo = validarContagemEstoque(
      insumos,
      { 'ins-pao': { texto: '5', modoUnidade: 'BASE' } },
      'a'.repeat(501),
    );
    expect(motivoLongo.valido).toBe(false);
    expect(motivoLongo.erros.motivo).toBe('O motivo deve ter no máximo 500 caracteres.');

    const semMotivo = validarContagemEstoque(insumos, { 'ins-pao': { texto: '5', modoUnidade: 'BASE' } }, 'ab');
    expect(semMotivo.valido).toBe(false);
    expect(semMotivo.erros.motivo).toBe('Informe o motivo com pelo menos 3 caracteres.');

    // Nenhum preenchido vs preenchido inválido
    const nenhum = validarContagemEstoque(insumos, {}, 'Contagem semanal');
    expect(nenhum.valido).toBe(false);
    expect(nenhum.erros.geral).toBe('Preencha o saldo contado de pelo menos um insumo.');

    const comErroLinha = validarContagemEstoque(
      insumos,
      { 'ins-pao': { texto: '5.000', modoUnidade: 'BASE' } },
      'Contagem semanal',
    );
    expect(comErroLinha.valido).toBe(false);
    expect(comErroLinha.erros.geral).toBeUndefined();
    expect(comErroLinha.erros.porInsumo['ins-pao']).toBe(
      'Para 5 mil, digite 5000 (use vírgula só para decimais)',
    );

    // Limite de 200 itens
    const insumos201 = Array.from({ length: MAX_ITENS_CONTAGEM + 1 }, (_, i) => ({
      id: `ins-${i}`,
      nome: `Insumo ${i}`,
      unidade: 'Unidade',
      estoqueAtual: 5,
    }));
    const entradas200 = Object.fromEntries(
      insumos201.slice(0, MAX_ITENS_CONTAGEM).map((i) => [i.id, { texto: '5', modoUnidade: 'BASE' as const }]),
    );
    expect(validarContagemEstoque(insumos201, entradas200, 'Inventário').valido).toBe(true);

    const entradas201 = Object.fromEntries(
      insumos201.map((i) => [i.id, { texto: '5', modoUnidade: 'BASE' as const }]),
    );
    const excesso = validarContagemEstoque(insumos201, entradas201, 'Inventário');
    expect(excesso.valido).toBe(false);
    expect(excesso.erros.geral).toBe('Máximo de 200 itens por contagem.');

    expect(
      chaveConteudoContagem('Contagem A', res.itensPayload),
    ).not.toBe(chaveConteudoContagem('Contagem B', res.itensPayload));
    expect(
      chaveConteudoContagem('  Contagem A  ', res.itensPayload),
    ).toBe(chaveConteudoContagem('Contagem A', res.itensPayload));
  });

  it('classifica erros HTTP 403, 404, 409, 400, rede/5xx e erros genéricos', () => {
    const selecionados = [
      { id: 'ins-1', nome: 'Carne de Hambúrguer' },
      { id: 'ins-2', nome: 'Pão Brioche' },
    ];

    expect(
      classificarErroContagem(criarErroAxios(403, { message: 'Proibido' }), selecionados),
    ).toEqual({
      tipo: 'proibido',
      mensagem: 'Só gerente ou administrador pode registrar contagem.',
    });

    expect(
      classificarErroContagem(criarErroAxios(409, { message: 'Conflito' }), selecionados),
    ).toEqual({
      tipo: 'conflito',
      mensagem:
        'Esta chave de tentativa já foi usada com conteúdo diferente. Uma nova chave foi preparada; confira o estoque antes de enviar novamente.',
    });

    const err404Id = classificarErroContagem(
      criarErroAxios(404, { message: 'Insumo não encontrado: ins-2' }),
      selecionados,
    );
    expect(err404Id.tipo).toBe('nao_encontrado');
    expect(err404Id.mensagem).toContain('Pão Brioche');
    expect(err404Id.mensagem).not.toContain('Carne de Hambúrguer');

    const err404Nome = classificarErroContagem(
      criarErroAxios(404, { message: 'Insumo CARNE DE HAMBÚRGUER removido' }),
      selecionados,
    );
    expect(err404Nome.mensagem).toContain('Carne de Hambúrguer');
    expect(err404Nome.mensagem).not.toContain('Pão Brioche');

    const err404Fallback = classificarErroContagem(criarErroAxios(404, {}), selecionados);
    expect(err404Fallback.mensagem).toContain('Carne de Hambúrguer, Pão Brioche');
    expect(err404Fallback.mensagem).toContain('Insumo não encontrado.');

    expect(classificarErroContagem(criarErroAxios(404, {}), [])).toEqual({
      tipo: 'nao_encontrado',
      mensagem: 'Insumo não encontrado.',
    });

    expect(
      classificarErroContagem(criarErroAxios(400, { message: 'Motivo curto' }), selecionados),
    ).toEqual({
      tipo: 'validacao',
      mensagem: 'Motivo curto',
    });
    expect(classificarErroContagem(criarErroAxios(400, {}), selecionados)).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a contagem.',
    });

    const errRede = classificarErroContagem(
      new axios.AxiosError('Network Error', 'ERR_NETWORK'),
      selecionados,
    );
    expect(errRede.tipo).toBe('rede');
    expect(errRede.mensagem).toMatch(/mesma chave será usada/i);

    const err500 = classificarErroContagem(criarErroAxios(500, {}), selecionados);
    expect(err500.tipo).toBe('rede');
    expect(err500.mensagem).toMatch(/mesma chave será usada/i);

    expect(classificarErroContagem(new Error('Erro local'), selecionados)).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a contagem.',
    });
    expect(classificarErroContagem({}, selecionados)).toEqual({
      tipo: 'validacao',
      mensagem: 'Não foi possível registrar a contagem.',
    });
  });
});
