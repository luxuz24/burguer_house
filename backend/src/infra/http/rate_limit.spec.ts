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

  it('429 traz mensagem em português e Retry-After restante da janela', async () => {
    vi.useFakeTimers();
    const limite = criarRateLimit({ max: 1, janelaMs: 10_000 });
    await limite(req('1.1.1.1'), fakeReply());
    vi.advanceTimersByTime(4_200);
    const r = fakeReply();
    await limite(req('1.1.1.1'), r);
    expect(r.header).toHaveBeenCalledWith('Retry-After', '6');
    expect(r.send).toHaveBeenCalledWith({ message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  });

  it('a janela só reinicia quando passa exatamente janelaMs (limite inclusivo)', async () => {
    vi.useFakeTimers();
    const limite = criarRateLimit({ max: 1, janelaMs: 1000 });
    await limite(req('1.1.1.1'), fakeReply());
    vi.advanceTimersByTime(999);
    const dentro = fakeReply();
    await limite(req('1.1.1.1'), dentro);
    expect(dentro.status).toHaveBeenCalledWith(429);
    vi.advanceTimersByTime(1);
    const exata = fakeReply();
    await limite(req('1.1.1.1'), exata);
    expect(exata.status).not.toHaveBeenCalled();
  });

  it('chave personalizada isola contadores (ex.: por usuário, independente do IP)', async () => {
    const limite = criarRateLimit({ max: 1, janelaMs: 1000, chave: (r) => (r as unknown as { u: string }).u });
    const a1 = fakeReply();
    await limite({ ip: '1.1.1.1', u: 'A' } as unknown as FastifyRequest, a1);
    const a2 = fakeReply();
    await limite({ ip: '9.9.9.9', u: 'A' } as unknown as FastifyRequest, a2);
    const b = fakeReply();
    await limite({ ip: '1.1.1.1', u: 'B' } as unknown as FastifyRequest, b);
    expect(a1.status).not.toHaveBeenCalled();
    expect(a2.status).toHaveBeenCalledWith(429);
    expect(b.status).not.toHaveBeenCalled();
  });

  describe('limpeza de entradas expiradas (memória limitada)', () => {
    async function encher(limite: ReturnType<typeof criarRateLimit>, n: number) {
      for (let i = 0; i < n; i++) await limite(req(`ip-${i}`), fakeReply());
    }

    it('com 10.000 entradas ainda não limpa', async () => {
      vi.useFakeTimers();
      const del = vi.spyOn(Map.prototype, 'delete');
      const limite = criarRateLimit({ max: 5, janelaMs: 1000 });
      await encher(limite, 10_000);
      vi.advanceTimersByTime(5_000);
      await limite(req('novo'), fakeReply());
      expect(del).not.toHaveBeenCalled();
      del.mockRestore();
    }, 15_000);

    it('acima de 10.000 remove só as expiradas e preserva as vigentes (ainda bloqueadas)', async () => {
      vi.useFakeTimers();
      const del = vi.spyOn(Map.prototype, 'delete');
      const limite = criarRateLimit({ max: 1, janelaMs: 1000 });
      await encher(limite, 10_000);
      vi.advanceTimersByTime(500);
      await limite(req('vigente'), fakeReply()); // entrada nova, 500ms mais jovem; size agora 10.001
      vi.advanceTimersByTime(600); // as 10.000 antigas expiraram (1100ms), 'vigente' tem 600ms
      del.mockClear();
      await limite(req('gatilho'), fakeReply());
      expect(del).toHaveBeenCalledTimes(10_000);
      const vig = fakeReply();
      await limite(req('vigente'), vig); // segunda chamada dentro da janela: continua bloqueada
      expect(vig.status).toHaveBeenCalledWith(429);
      del.mockRestore();
    }, 15_000);
  });
});
