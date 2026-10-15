import { timingSafeEqual } from 'node:crypto';

/** Compara segredos em tempo constante (evita timing attack). */
export function segredoValido(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
