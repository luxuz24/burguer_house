import { describe, expect, it } from 'vitest';
import { exigirAmbienteDeTeste } from './setup_test_db.js';

describe('setup_test_db (guarda global dos testes)', () => {
  it('bloqueia execução quando NODE_ENV não é test', () => {
    expect(() =>
      exigirAmbienteDeTeste({
        NODE_ENV: 'development',
        DATABASE_URL_TEST: 'postgresql://localhost:5433/burguer_house_test',
      }),
    ).toThrow(/NODE_ENV deve ser "test"/);
  });

  it('bloqueia execução quando DATABASE_URL_TEST está ausente ou vazia', () => {
    expect(() =>
      exigirAmbienteDeTeste({
        NODE_ENV: 'test',
      }),
    ).toThrow(/DATABASE_URL_TEST/);

    expect(() =>
      exigirAmbienteDeTeste({
        NODE_ENV: 'test',
        DATABASE_URL_TEST: '',
      }),
    ).toThrow(/DATABASE_URL_TEST/);
  });

  it('bloqueia execução quando DATABASE_URL_TEST não aponta para um banco _test', () => {
    expect(() =>
      exigirAmbienteDeTeste({
        NODE_ENV: 'test',
        DATABASE_URL_TEST: 'postgresql://localhost:5432/burguer_house',
      }),
    ).toThrow(/_test/);
  });

  it('retorna DATABASE_URL_TEST quando o ambiente de teste é válido', () => {
    const url = 'postgresql://test_user:test_password@localhost:5433/burguer_house_test?schema=public';
    expect(
      exigirAmbienteDeTeste({
        NODE_ENV: 'test',
        DATABASE_URL_TEST: url,
      }),
    ).toBe(url);
  });
});
