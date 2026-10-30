import { AnotaAIAdapter, normalizarNomeProduto } from './anotaai.adapter.js';
import type { ItemVenda } from './anotaai.adapter.js';

export type { ItemVenda };
export { normalizarNomeProduto };

export interface ItemVendaExpandido {
  nome: string;
  quantidade: number;
  preco: number;
}

/**
 * Expande recursivamente uma lista de itens e seus modificadores/adicionais (subItens).
 * A quantidade de cada subItem é multiplicada pela quantidade acumulada do item pai.
 */
export function expandirItens(
  lista: ItemVenda[],
  multiplicadorPai = 1,
): ItemVendaExpandido[] {
  const resultado: ItemVendaExpandido[] = [];
  for (const item of lista) {
    const qtdEfetiva = item.quantidade * multiplicadorPai;
    resultado.push({ nome: item.nome, quantidade: qtdEfetiva, preco: item.preco });
    if (item.subItens && item.subItens.length > 0) {
      resultado.push(...expandirItens(item.subItens, qtdEfetiva));
    }
  }
  return resultado;
}

const adapter = new AnotaAIAdapter();

/**
 * Extrai os itens vendidos do payload bruto do Anota AI de forma defensiva: nunca lança.
 * Suporta subItems/adicionais.
 * Usada pela consolidação de estoque e pelo dashboard para ambos lerem o mesmo formato.
 */
export function extrairItens(payload: unknown): ItemVenda[] {
  return adapter.extrairItens(payload);
}
