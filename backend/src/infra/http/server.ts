import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

export interface ShutdownDeps {
  app: {
    close: () => Promise<void>;
    log: {
      info: (msg: string) => void;
      error: (obj: unknown, msg?: string) => void;
    };
  };
  db: {
    $disconnect: () => Promise<void>;
  };
  exit?: (code: number) => void;
  timeoutMs?: number;
}

export function criarShutdownHandler(deps: ShutdownDeps) {
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let encerrando = false;

  return async (sinal: string): Promise<void> => {
    if (encerrando) return;
    encerrando = true;

    deps.app.log.info(`Sinal ${sinal} recebido. Encerrando servidor HTTP e conexões com o banco...`);

    const timer = setTimeout(() => {
      deps.app.log.error(`Timeout de ${timeoutMs}ms excedido no graceful shutdown. Forçando saída.`);
      exit(1);
    }, timeoutMs);
    timer.unref?.();

    let codigoSaida = 0;
    try {
      await deps.app.close();
    } catch (err) {
      codigoSaida = 1;
      deps.app.log.error({ err }, 'Erro ao fechar servidor Fastify');
    }

    try {
      await deps.db.$disconnect();
    } catch (err) {
      codigoSaida = 1;
      deps.app.log.error({ err }, 'Erro ao desconectar Prisma');
    } finally {
      clearTimeout(timer);
    }

    exit(codigoSaida);
  };
}

export const start = async () => {
  const shutdown = criarShutdownHandler({ app, db: prisma });
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  const port = Number(process.env.PORT) || 3000;
  try {
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Servidor rodando em http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
};

const executadoDiretamente =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]!);

if (executadoDiretamente) {
  void start();
}