import { describe, it, expect, vi } from 'vitest';
import { criarShutdownHandler } from './server.js';

describe('criarShutdownHandler (Graceful Shutdown)', () => {
  it('fecha o Fastify, desconecta o Prisma na ordem correta e encerra com código 0', async () => {
    const ordem: string[] = [];
    const close = vi.fn(async () => {
      ordem.push('app.close');
    });
    const disconnect = vi.fn(async () => {
      ordem.push('db.$disconnect');
    });
    const exit = vi.fn((code: number) => {
      ordem.push(`exit:${code}`);
    });

    const handler = criarShutdownHandler({
      app: { close, log: { info: vi.fn(), error: vi.fn() } },
      db: { $disconnect: disconnect },
      exit,
    });

    await handler('SIGTERM');

    expect(ordem).toEqual(['app.close', 'db.$disconnect', 'exit:0']);
  });

  it('ignora sinais duplicados enquanto o encerramento já está em andamento', async () => {
    const close = vi.fn(async () => {});
    const disconnect = vi.fn(async () => {});
    const exit = vi.fn();

    const handler = criarShutdownHandler({
      app: { close, log: { info: vi.fn(), error: vi.fn() } },
      db: { $disconnect: disconnect },
      exit,
    });

    await Promise.all([handler('SIGTERM'), handler('SIGINT')]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('ainda desconecta o banco e sai com código 1 se app.close falhar', async () => {
    const close = vi.fn(async () => {
      throw new Error('Falha ao fechar HTTP');
    });
    const disconnect = vi.fn(async () => {});
    const exit = vi.fn();
    const errorLog = vi.fn();

    const handler = criarShutdownHandler({
      app: { close, log: { info: vi.fn(), error: errorLog } },
      db: { $disconnect: disconnect },
      exit,
    });

    await handler('SIGINT');

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
