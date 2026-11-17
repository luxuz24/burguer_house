/** O backend devolve no máximo os 10 produtos mais vendidos (GET /api/dashboard/resumo). */
export const LIMITE_MAIS_VENDIDOS_BACKEND = 10;

/**
 * Soma dos itens que saíram, a partir da lista de mais vendidos. Só vale quando a lista está completa:
 * com 10 produtos ou mais ela pode estar cortada e a soma ficaria menor que a real, então devolve null.
 */
export function totalItensQueSairam(itens: Array<{ quantidadeVendida: number }>): number | null {
  if (itens.length === 0 || itens.length >= LIMITE_MAIS_VENDIDOS_BACKEND) return null;
  return itens.reduce((soma, i) => soma + (Number.isFinite(i.quantidadeVendida) ? i.quantidadeVendida : 0), 0);
}
