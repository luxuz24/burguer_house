import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { criarRateLimit } from './rate_limit.js';

function fakeReply() {
  const reply = {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & typeof reply;
}
const req = (ip: string) => ({ ip }) as FastifyRequest;

describe('criarRateLimit', () => {
  afterEach(() => vi.useRealTimers());

  it('bloqueia depois do limite, isola por IP e libera na nova janela', async () => {
    vi.useFakeTimers();
    const limite = criarRateLimit({ max: 2, janelaMs: 1000 });

    for (let i = 0; i < 2; i++) {
      const r = fakeReply();
      await limite(req('1.1.1.1'), r);
      expect(r.status).not.toHaveBeenCalled();
    }

    const bloqueada = fakeReply();
    await limite(req('1.1.1.1'), bloqueada);
    expect(bloqueada.status).toHaveBeenCalledWith(429);
    expect(bloqueada.header).toHaveBeenCalledWith('Retry-After', '1');

    const outroIp = fakeReply();
    await limite(req('2.2.2.2'), outroIp);
    expect(outroIp.status).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1001);
    const liberada = fakeReply();
    await limite(req('1.1.1.1'), liberada);
    expect(liberada.status).not.toHaveBeenCalled();
  });
});
