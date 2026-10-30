import { describe, it, expect } from 'vitest';
import {
  TIMEZONE_LOJA,
  obterAnoEMesLoja,
  obterIntervaloMesLoja,
  obterIntervaloDiaLoja,
  obterIntervaloSemanaLoja,
  obterPartesDataLoja,
  criarDataLoja,
} from './datas.js';

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

  it('obterIntervaloMesLoja gera os limites exatos em UTC através de criarDataLoja sem hardcode', () => {
    const { inicio, fim } = obterIntervaloMesLoja(2026, 10);

    expect(inicio.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(fim.toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });

  it('obterIntervaloMesLoja faz a virada correta de ano em dezembro', () => {
    const { inicio, fim } = obterIntervaloMesLoja(2026, 12);

    expect(inicio.toISOString()).toBe('2026-12-01T04:00:00.000Z');
    expect(fim.toISOString()).toBe('2027-01-01T04:00:00.000Z');
  });

  it('obterIntervaloDiaLoja calcula o início e fim de "hoje" no fuso de MS às 21h (pico noturno)', () => {
    // 21:00 de 30/10 em Campo Grande = 2026-10-31T01:00:00.000Z
    const dataNoturnaPico = new Date('2026-10-31T01:00:00.000Z');
    const { inicio, fim, ano, mes, dia } = obterIntervaloDiaLoja(dataNoturnaPico);

    expect(ano).toBe(2026);
    expect(mes).toBe(10);
    expect(dia).toBe(30);

    expect(inicio.toISOString()).toBe('2026-10-30T04:00:00.000Z'); // 00:00:00 em MS
    expect(fim.toISOString()).toBe('2026-10-31T03:59:59.999Z');    // 23:59:59.999 em MS
  });

  it('obterIntervaloSemanaLoja cobre 7 dias retroativos até o fim do dia de hoje', () => {
    const dataNoturnaPico = new Date('2026-10-31T01:00:00.000Z'); // 30/10 em MS
    const { inicio, fim } = obterIntervaloSemanaLoja(dataNoturnaPico);

    expect(fim.toISOString()).toBe('2026-10-31T03:59:59.999Z');
    expect(inicio.toISOString()).toBe('2026-10-23T04:00:00.000Z');
  });

  it('obterPartesDataLoja extrai corretamente os campos locais de Campo Grande', () => {
    const data = new Date('2026-10-31T01:30:45.000Z'); // 21:30:45 em MS
    const partes = obterPartesDataLoja(data);

    expect(partes).toEqual({
      ano: 2026,
      mes: 10,
      dia: 30,
      hora: 21,
      minuto: 30,
      segundo: 45,
    });
  });

  it('criarDataLoja converte hora local para UTC', () => {
    const d = criarDataLoja(2026, 10, 30, 21, 0, 0, 0);
    expect(d.toISOString()).toBe('2026-10-31T01:00:00.000Z');
  });
});
