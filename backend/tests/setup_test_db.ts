import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(backendDir, '.env'), quiet: true });

export function exigirAmbienteDeTeste(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV !== 'test') {
    throw new Error(
      `Execução de testes bloqueada: NODE_ENV deve ser "test" (recebido: "${env.NODE_ENV ?? ''}").`,
    );
  }

  const testUrl = env.DATABASE_URL_TEST;
  if (!testUrl || !testUrl.includes('_test')) {
    throw new Error(
      'Execução de testes bloqueada: DATABASE_URL_TEST deve estar definida e apontar para um banco *_test.',
    );
  }

  return testUrl;
}

exigirAmbienteDeTeste();
