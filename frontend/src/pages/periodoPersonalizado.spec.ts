import { describe, it, expect } from 'vitest';
import { validarPeriodo, diasNoPeriodo, hojeNaLoja, inicioDoMesNaLoja, diaPorExtensoCurto, MAX_DIAS_PERIODO } from './periodoPersonalizado';

describe('pages/periodoPersonalizado', () => {
  it('diasNoPeriodo conta os dois extremos e atravessa ano bissexto', () => {
    expect(diasNoPeriodo('2026-11-10', '2026-11-10')).toBe(1);
    expect(diasNoPeriodo('2026-11-01', '2026-11-30')).toBe(30);
    expect(diasNoPeriodo('2028-02-28', '2028-03-01')).toBe(3);
    expect(diasNoPeriodo('2026-11-10', '2026-11-09')).toBe(0);
    expect(diasNoPeriodo('2026-13-01', '2026-11-09')).toBeNull();
    expect(diasNoPeriodo('2026-11-01', 'x')).toBeNull();
  });

  it('aceita o período válido, inclusive um dia só', () => {
    expect(validarPeriodo('2026-11-01', '2026-11-10')).toBeNull();
    expect(validarPeriodo('2026-11-10', '2026-11-10')).toBeNull();
  });

  it('datas vazias, mal formatadas ou inexistentes', () => {
    expect(validarPeriodo('', '2026-11-10')).toBe('Informe as duas datas.');
    expect(validarPeriodo('2026-11-10', '')).toBe('Informe as duas datas.');
    expect(validarPeriodo('10/11/2026', '2026-11-10')).toBe('Data inválida.');
    expect(validarPeriodo('2026-11-01', '2026-11-1')).toBe('Data inválida.');
    expect(validarPeriodo('2026-02-30', '2026-03-10')).toBe('Data inválida.');
    expect(validarPeriodo('2026-02-01', '2026-02-29')).toBe('Data inválida.');
    expect(validarPeriodo('2028-02-01', '2028-02-29')).toBeNull();
  });

  it('início depois do fim', () => {
    expect(validarPeriodo('2026-11-11', '2026-11-10')).toBe('A data de início não pode ser depois da data de fim.');
  });

  it('limite de 366 dias com os extremos (paridade com dashboard.service.ts)', () => {
    expect(MAX_DIAS_PERIODO).toBe(366);
    // 366 dias contando os dois extremos: o backend aceita (fim 23:59 - início 00:00 = 365,99 dias)
    expect(validarPeriodo('2026-01-01', '2027-01-01')).toBeNull();
    // 367 dias: o backend recusa (366,99 > 366)
    expect(validarPeriodo('2026-01-01', '2027-01-02')).toBe('O período pode ter no máximo 366 dias.');
  });

  it('hoje e início do mês no fuso da loja (UTC-4), inclusive na virada do dia', () => {
    // 03:30 UTC de 01/12 ainda é 30/11 23:30 em Campo Grande
    const agora = new Date('2026-12-01T03:30:00Z');
    expect(hojeNaLoja(agora)).toBe('2026-11-30');
    expect(inicioDoMesNaLoja(agora)).toBe('2026-11-01');
    expect(hojeNaLoja(new Date('2026-12-01T04:30:00Z'))).toBe('2026-12-01');
  });

  it('diaPorExtensoCurto', () => {
    expect(diaPorExtensoCurto('2026-11-01')).toBe('01/11/2026');
    expect(diaPorExtensoCurto('lixo')).toBe('lixo');
  });
});
