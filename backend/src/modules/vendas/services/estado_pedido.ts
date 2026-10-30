import { AnotaAIAdapter } from './anotaai.adapter.js';
import type { DestinoVenda } from './anotaai.adapter.js';

export type { DestinoVenda };

const adapter = new AnotaAIAdapter();

/** Lê o `check` do payload (raiz, `info.check` do envelope da API ou `order.check`). Retorna null se não houver. */
export function extrairEstadoPedido(payload: unknown): number | null {
  return adapter.extrairEstadoPedido(payload);
}

/**
 * Classifica a venda:
 * - abater: pedido aceito (1, 2 ou 3);
 * - ignorar: cancelado/negado/rejeitado/expirado (4, 5, -4, 41, 42);
 * - aguardar: ainda não aceito ou agendado (0, -2, -1, -3, 6) OU sem check (fail-safe).
 */
export function classificarVenda(payload: unknown): DestinoVenda {
  return adapter.classificarVenda(payload);
}
