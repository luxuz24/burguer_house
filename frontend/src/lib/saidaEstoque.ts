import { formatarQuantidade } from './formatar';

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

/**
 * Quantos dos pedidos do período vieram do fechamento manual (`kpis.vendasManuaisQtd`, GET /api/dashboard/resumo).
 * É um subconjunto já incluído em `totalVendasQtd`: só informa, nunca soma. Único ponto em que o campo
 * ausente (backend antigo) ou inválido vira 0.
 */
export function pedidosManuais(kpis: { vendasManuaisQtd?: unknown } | null | undefined): number {
  const qtd = kpis?.vendasManuaisQtd;
  return typeof qtd === 'number' && Number.isFinite(qtd) && qtd > 0 ? Math.trunc(qtd) : 0;
}

/** "18 lançados no fechamento do dia" (cartão Pedidos dos Relatórios). */
export function textoPedidosManuaisRelatorio(qtd: number): string {
  return `${formatarQuantidade(qtd)} ${qtd === 1 ? 'lançado' : 'lançados'} no fechamento do dia`;
}

/** "inclui 3 pedidos lançados à mão" (cartão Saída de hoje do Início). */
export function textoPedidosManuaisInicio(qtd: number): string {
  return `inclui ${formatarQuantidade(qtd)} ${qtd === 1 ? 'pedido lançado' : 'pedidos lançados'} à mão`;
}
