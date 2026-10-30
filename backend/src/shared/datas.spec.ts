import { describe, it, expect } from 'vitest';
import { TIMEZONE_LOJA, obterAnoEMesLoja, obterIntervaloMesLoja } from './datas.js';

describe('Utilitários de data e fuso da loja (America/Campo_Grande)', () => {
  it('TIMEZONE_LOJA deve ser America/Campo_Grande', () => {
    expect(TIMEZONE_LOJA).toBe('America/Campo_Grande');
  });

  it('obterAnoEMesLoja calcula o mês civil correto no fuso de MS durante o horário noturno (UTC-4)', () => {
    // 22h de 31/10 em Campo Grande é 02:00:00Z de 01/11 em UTC.
    // Em UTC já é novembro, mas em MS ainda é outubro!
    const dataNoturnaFimDoMes = new Date('2026-11-01T02:00:00.000Z');
    const { ano, mes } = obterAnoEMesLoja(dataNoturnaFimDoMes);

    expect(ano).toBe(2026);
    expect(mes).toBe(10);
  });

  it('obterAnoEMesLoja vira o mês apenas quando passa da meia-noite em MS', () => {
    // 00h05 de 01/11 em Campo Grande é 04:05:00Z de 01/11 em UTC.
    const dataInicioDoMes = new Date('2026-11-01T04:05:00.000Z');
    const { ano, mes } = obterAnoEMesLoja(dataInicioDoMes);

    expect(ano).toBe(2026);
    expect(mes).toBe(11);
  });

  it('obterIntervaloMesLoja gera os limites exatos em UTC com offset de 4 horas', () => {
    const { inicio, fim } = obterIntervaloMesLoja(2026, 10);

    expect(inicio.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });

  it('obterIntervaloMesLoja faz a virada correta de ano em dezembro', () => {
    const { inicio, fim } = obterIntervaloMesLoja(2026, 12);

    expect(inicio.toISOString()).toBe('2026-12-01T04:00:00.000Z');
    expect(fim.toISOString()).toBe('2027-01-01T04:00:00.000Z');
  });
});
