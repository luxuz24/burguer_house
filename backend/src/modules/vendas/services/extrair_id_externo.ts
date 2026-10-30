import { AnotaAIAdapter } from './anotaai.adapter.js';

const adapter = new AnotaAIAdapter();

/**
 * Extrai o identificador único do pedido/evento a partir do payload ou dos headers
 * enviados pela Anota AI. Prioriza o identificador do pedido no payload para garantir
 * integridade do ciclo de vida da venda.
 * Retorna `null` quando nenhum identificador explícito está presente.
 */
export function extrairIdExterno(
  payload: unknown,
  headers?: Record<string, unknown>,
): string | null {
  return adapter.extrairIdExterno(payload, headers);
}
