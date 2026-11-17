import { afterEach, describe, expect, it, vi } from 'vitest';
import { gerarChaveIdempotencia } from './chaveIdempotencia';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('lib/chaveIdempotencia', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa crypto.randomUUID quando existe', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-2222-4333-8444-555555555555' });
    expect(gerarChaveIdempotencia()).toBe('11111111-2222-4333-8444-555555555555');
  });

  it('sem randomUUID (http://IP no celular) cai para getRandomValues e devolve 36 caracteres diferentes a cada chamada', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array) => {
        for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
        return b;
      },
    });
    const chaves = Array.from({ length: 20 }, () => gerarChaveIdempotencia());
    for (const c of chaves) {
      expect(c).toHaveLength(36);
      expect(c).toMatch(UUID_V4);
    }
    expect(new Set(chaves).size).toBe(20);
  });

  it('getRandomValues determinístico gera o UUID v4 esperado (bits de versão e variante)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.fill(0xff); return b; } });
    expect(gerarChaveIdempotencia()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => { b.fill(0); return b; } });
    expect(gerarChaveIdempotencia()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('sem nenhum crypto ainda gera uma chave válida de 36 caracteres', () => {
    vi.stubGlobal('crypto', undefined);
    const a = gerarChaveIdempotencia();
    const b = gerarChaveIdempotencia();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
