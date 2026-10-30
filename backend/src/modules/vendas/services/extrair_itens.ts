import { AnotaAIAdapter } from './anotaai.adapter.js';
import type { ItemVenda } from './anotaai.adapter.js';

export type { ItemVenda };

const adapter = new AnotaAIAdapter();

/**
 * Extrai os itens vendidos do payload bruto do Anota AI de forma defensiva: nunca lança.
 * Suporta subItems/adicionais.
 * Usada pela consolidação de estoque e pelo dashboard para ambos lerem o mesmo formato.
 */
export function extrairItens(payload: unknown): ItemVenda[] {
  return adapter.extrairItens(payload);
}
