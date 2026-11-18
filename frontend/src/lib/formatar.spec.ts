import { describe, it, expect } from 'vitest';
import {
  saudacao,
  dataPorExtenso,
  dataSugeridaFechamento,
  dataHojeNaLoja,
  msAteProximaMeiaNoiteNaLoja,
  msAteProximaFronteiraSaudacaoNaLoja,
  formatarMoeda,
  formatarQuantidade,
  formatarPercentual,
  descontoComPerda,
  consumoProducao,
  formatarDataHora,
  textoValidade,
  normalizarBusca,
} from './formatar';

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

  describe('descontoComPerda (Paridade A5 com o backend)', () => {
    // Casos de teste obtidos diretamente rodando a fórmula determinística do backend:
    // backend/src/modules/vendas/services/planejar_consolidacao.ts:197
    // fatorPerda = Math.max(0, ficha.insumo.fatorPerda || 0)
    // desconto = quantidade * (1 + fatorPerda)
    // backend/src/modules/vendas/services/consolidacao.service.ts:96
    // quantidadeArredondada = Number(info.desconto.toFixed(4))
    it('calcula desconto com perda com exata paridade com planejarConsolidacao', () => {
      // Casos com quantidade fracionária (0.3333)
      expect(descontoComPerda(0.3333, -0.1)).toBe(0.3333); // fator negativo tratado como 0
      expect(descontoComPerda(0.3333, null)).toBe(0.3333);  // fator nulo tratado como 0
      expect(descontoComPerda(0.3333, 0)).toBe(0.3333);     // fator zero
      expect(descontoComPerda(0.3333, 0.05)).toBe(0.35);    // 0.3333 * 1.05 = 0.349965 -> toFixed(4) = 0.35
      expect(descontoComPerda(0.3333, 1)).toBe(0.6666);     // 0.3333 * 2 = 0.6666

      // Casos com quantidade inteira (150)
      expect(descontoComPerda(150, -0.1)).toBe(150);
      expect(descontoComPerda(150, null)).toBe(150);
      expect(descontoComPerda(150, 0)).toBe(150);
      expect(descontoComPerda(150, 0.05)).toBe(157.5);
      expect(descontoComPerda(150, 1)).toBe(300);
    });

    it('formata adequadamente com formatarQuantidade até 4 casas decimais', () => {
      expect(formatarQuantidade(descontoComPerda(0.3333, -0.1), 'g')).toBe('0,3333 g');
      expect(formatarQuantidade(descontoComPerda(0.3333, 0.05), 'g')).toBe('0,35 g');
      expect(formatarQuantidade(descontoComPerda(0.3333, 1), 'g')).toBe('0,6666 g');
      expect(formatarQuantidade(descontoComPerda(150, 0.05), 'g')).toBe('157,5 g');
      expect(formatarQuantidade(descontoComPerda(150, 1), 'g')).toBe('300 g');
    });

    it('normaliza valores negativos ou indefinidos de quantidade para zero', () => {
      expect(descontoComPerda(-10, 0.1)).toBe(0);
      expect(descontoComPerda(null, 0.1)).toBe(0);
      expect(descontoComPerda(undefined, 0.1)).toBe(0);
    });
  });

  describe('consumoProducao (Paridade com producao.service.ts:41)', () => {
    // producao.service.ts:41
    // consumo: Number((ing.quantidadeNecessaria * (1 + ing.insumoBruto.fatorPerda) * quantidade).toFixed(4))
    it('calcula consumo de producao com exata paridade com producao.service.ts', () => {
      // 1. Proporção exata simples
      expect(consumoProducao(0.5, 0, 200)).toBe(100);

      // 2. Fator de perda positivo (5% e 10%)
      expect(consumoProducao(0.05, 0.1, 50)).toBe(2.75); // 0.05 * 1.1 * 50 = 2.75
      expect(consumoProducao(0.33333, 0.05, 30)).toBe(10.4999); // 0.33333 * 1.05 * 30 = 10.499895 -> 10.4999

      // 3. Caso de borda crítico: arredondamento em 4 casas decimais vs estoque
      // 1.000004 * 10 = 10.00004 -> toFixed(4) = '10.0000' -> Number(...) = 10
      // Permite que estoqueAtual = 10 atenda o consumo sem falha por resíduo de ponto flutuante
      const consumoBorda = consumoProducao(1.000004, 0, 10);
      expect(consumoBorda).toBe(10);
      expect(10 >= consumoBorda).toBe(true);

      // 4. producao.service.ts não normaliza fator de perda negativo (diferença documentada em docs/requests.md)
      expect(consumoProducao(1, -0.05, 10)).toBe(9.5); // 1 * 0.95 * 10 = 9.5

      // 5. Quantidade zero ou valores inválidos
      expect(consumoProducao(0.5, 0.1, 0)).toBe(0);
      expect(consumoProducao(null, 0.1, 10)).toBe(0);
      expect(consumoProducao(10, null, 1)).toBe(10);
    });
  });

  describe('formatarDataHora (Fuso America/Campo_Grande UTC-4)', () => {
    it('formata data e hora no fuso horário do MS com deslocamento correto de dia', () => {
      // 2026-11-01T03:30:00Z corresponde a 31/10/2026 às 23:30 em America/Campo_Grande (UTC-4)
      expect(formatarDataHora('2026-11-01T03:30:00Z')).toBe('31/10, 23:30');
      // Horário diurno no mesmo dia
      expect(formatarDataHora('2026-11-01T16:45:00Z')).toBe('01/11, 12:45');
    });

    it('retorna traço em-dash (—) para datas nulas ou inválidas', () => {
      expect(formatarDataHora(null)).toBe('—');
      expect(formatarDataHora(undefined)).toBe('—');
      expect(formatarDataHora('')).toBe('—');
      expect(formatarDataHora('data-invalida')).toBe('—');
    });
  });
});

describe('saudação e data no fuso da loja (tela inicial)', () => {
  it('usa a hora de Campo Grande (UTC-4), não a do aparelho', () => {
    // 2026-11-10 13:30 UTC = 09:30 na loja → bom dia; 22:30 UTC = 18:30 → boa noite
    expect(saudacao(new Date('2026-11-10T13:30:00Z'))).toBe('Bom dia');
    expect(saudacao(new Date('2026-11-10T17:00:00Z'))).toBe('Boa tarde');
    expect(saudacao(new Date('2026-11-10T22:30:00Z'))).toBe('Boa noite');
  });

  it('escreve a data por extenso sem "-feira" e com a inicial maiúscula, no dia da loja', () => {
    expect(dataPorExtenso(new Date('2026-11-10T15:00:00Z'))).toBe('Terça, 10 de novembro');
    // 02:00 UTC do dia 11 ainda é dia 10 na loja
    expect(dataPorExtenso(new Date('2026-11-11T02:00:00Z'))).toBe('Terça, 10 de novembro');
  });

  describe('helpers de virada de dia e saudação no fuso da loja (tarefa 04)', () => {
    it('dataHojeNaLoja retorna o dia ISO no fuso de Campo Grande', () => {
      // 03:59 UTC do dia 13 = 23:59 do dia 12 em Campo Grande
      expect(dataHojeNaLoja(new Date('2026-11-13T03:59:00Z'))).toBe('2026-11-12');
      // 04:00 UTC do dia 13 = 00:00 do dia 13 em Campo Grande
      expect(dataHojeNaLoja(new Date('2026-11-13T04:00:00Z'))).toBe('2026-11-13');
    });

    it('msAteProximaMeiaNoiteNaLoja calcula milissegundos restantes até 00:00:00 em Campo Grande', () => {
      // 23:59:30 em Campo Grande (-04:00) = 03:59:30 UTC -> faltam 30s = 30.000 ms
      const d1 = new Date('2026-11-13T03:59:30.000Z');
      expect(msAteProximaMeiaNoiteNaLoja(d1)).toBe(30_000);

      // Perto da borda (23:59:59.500) -> faltam 500 ms
      const d2 = new Date('2026-11-13T03:59:59.500Z');
      expect(msAteProximaMeiaNoiteNaLoja(d2)).toBe(500);

      // Exatamente na meia-noite (00:00:00.000) -> faltam 24h = 86.400.000 ms até a próxima
      const d3 = new Date('2026-11-13T04:00:00.000Z');
      expect(msAteProximaMeiaNoiteNaLoja(d3)).toBe(86_400_000);
    });

    it('msAteProximaFronteiraSaudacaoNaLoja calcula ms até 12h, 18h ou meia-noite', () => {
      // 11:59:30 na loja (-04:00) = 15:59:30 UTC -> faltam 30s até as 12:00:00 (Boa tarde)
      const dManha = new Date('2026-11-12T15:59:30.000Z');
      expect(msAteProximaFronteiraSaudacaoNaLoja(dManha)).toBe(30_000);

      // 17:59:30 na loja = 21:59:30 UTC -> faltam 30s até as 18:00:00 (Boa noite)
      const dTarde = new Date('2026-11-12T21:59:30.000Z');
      expect(msAteProximaFronteiraSaudacaoNaLoja(dTarde)).toBe(30_000);

      // 23:59:30 na loja = 03:59:30 UTC do dia seguinte -> faltam 30s até 00:00:00 (Bom dia / virada)
      const dNoite = new Date('2026-11-13T03:59:30.000Z');
      expect(msAteProximaFronteiraSaudacaoNaLoja(dNoite)).toBe(30_000);
    });
  });
});

describe('textoValidade', () => {
  it('escreve o prazo curto, com vencido tendo prioridade', () => {
    expect(textoValidade(3)).toBe('Vence em 3 dias');
    expect(textoValidade(1)).toBe('Vence amanhã');
    expect(textoValidade(0)).toBe('Vence hoje');
    expect(textoValidade(-2)).toBe('Vencido');
    expect(textoValidade(2, true)).toBe('Vencido');
  });
});

describe('normalizarBusca', () => {
  it('ignora acento, maiúsculas e espaços nas pontas', () => {
    expect(normalizarBusca('  Pão Brioche ')).toBe('pao brioche');
    expect(normalizarBusca('AÇÚCAR')).toBe('acucar');
    expect(normalizarBusca('Maionese da Casa').includes(normalizarBusca('maionése'))).toBe(true);
  });
});

describe('dataSugeridaFechamento', () => {
  // Loja em Campo Grande (UTC-4). Ela fecha depois das 23h: até as 5:59 o fechamento ainda é do dia anterior.
  it.each([
    ['2026-11-19T03:30:00Z', '2026-11-18'], // 23:30 de quarta
    ['2026-11-19T04:00:00Z', '2026-11-18'], // 00:00 de quinta
    ['2026-11-19T09:59:59Z', '2026-11-18'], // 05:59 de quinta
    ['2026-11-19T10:00:00Z', '2026-11-19'], // 06:00 de quinta
    ['2026-12-01T05:00:00Z', '2026-11-30'], // 01:00 de 1º/12: volta para o mês anterior
    ['2027-01-01T04:30:00Z', '2026-12-31'], // 00:30 de 1º/1: volta para o ano anterior
  ])('em %s sugere %s', (agora, esperado) => {
    expect(dataSugeridaFechamento(new Date(agora))).toBe(esperado);
  });
});
