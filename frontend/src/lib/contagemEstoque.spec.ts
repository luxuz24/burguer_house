import { describe, it, expect } from 'vitest';
import {
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
    expect(parsearSaldoContado('0,0')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('0,00')).toEqual({ estado: 'valido', valor: 0 });
    expect(parsearSaldoContado('25')).toEqual({ estado: 'valido', valor: 25 });
    expect(parsearSaldoContado('3,2')).toEqual({ estado: 'valido', valor: 3.2 });

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
    expect(neg.estado).toBe('negativo');
    expect(neg.valor).toBeNull();

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

  it('valida lote apenas com itens preenchidos, exige motivo 3..500 e gera confirmação com diferenças', () => {
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
    expect(textoConf).toContain('Carne de Hambúrguer: 4.000 g → 3.200 g (−800 g)');
    expect(textoConf).toContain('1 item sem diferença');
    expect(textoConf).toMatch(/servidor recalcula/i);

    const semMotivo = validarContagemEstoque(insumos, { 'ins-pao': { texto: '5', modoUnidade: 'BASE' } }, 'ab');
    expect(semMotivo.valido).toBe(false);
    expect(semMotivo.erros.motivo).toBeTruthy();

    expect(
      chaveConteudoContagem('Contagem A', res.itensPayload),
    ).not.toBe(chaveConteudoContagem('Contagem B', res.itensPayload));

    expect(
      classificarErroContagem(criarErroAxios(403, { message: 'Proibido' }), []).mensagem,
    ).toBe('Só gerente ou administrador pode registrar contagem.');
  });
});
