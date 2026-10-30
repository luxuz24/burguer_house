import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { resolverTrustProxy, type TrustProxy } from './trust_proxy.js';
import { criarRateLimit } from './rate_limit.js';

describe('resolverTrustProxy', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['qualquer', false],
    ['true', true],
    [' true ', true],
    ['-1', false],
    ['1.5', false],
  ])('%j → %j', (entrada, esperado) => {
    expect(resolverTrustProxy(entrada)).toBe(esperado);
  });

  it.each([
    ['0', [false, false]],
    ['1', [true, false]],
    ['2', [true, true]],
  ])('número %s confia só nos N saltos mais próximos', (entrada, [hop0, hop1]) => {
    const f = resolverTrustProxy(entrada) as (a: string, h: number) => boolean;
    expect(typeof f).toBe('function');
    expect([f('x', 0), f('x', 1)]).toEqual([hop0, hop1]);
    expect(f('x', 2)).toBe(false);
  });
});

describe('rate limit atrás de proxy: forjar X-Forwarded-For', () => {
  async function tentativas(trustProxy: TrustProxy) {
    const app = Fastify({ trustProxy });
    app.get('/x', { onRequest: [criarRateLimit({ max: 2, janelaMs: 60_000 })] }, async () => 'ok');
    const status: number[] = [];
    for (let i = 0; i < 6; i++) {
      // o atacante (IP real 203.0.113.9) prefixa um IP falso novo a cada requisição; o proxy confiável acrescenta o IP real
      const r = await app.inject({ method: 'GET', url: '/x', headers: { 'x-forwarded-for': `1.1.1.${i}, 203.0.113.9` } });
      status.push(r.statusCode);
    }
    await app.close();
    return status;
  }

  it('trustProxy=true: o atacante burla o limite (documenta o risco)', async () => {
    expect(await tentativas(true)).not.toContain(429);
  });

  it('TRUST_PROXY=1: IP vem do proxy confiável, o limite vale', async () => {
    const s = await tentativas(resolverTrustProxy('1'));
    expect(s.slice(0, 2)).toEqual([200, 200]);
    expect(s.slice(2).every((x) => x === 429)).toBe(true);
  });
});
