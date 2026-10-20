export interface ItemVenda {
  nome: string;
  quantidade: number;
  preco: number;
}

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

/**
 * Extrai os itens vendidos do payload bruto do Anota AI de forma defensiva: nunca lança.
 * Aceita o array na raiz, `items`, `order.items` ou `info.items`, com campos em inglês (name/quantity/price/unitPrice)
 * ou português (nome/quantidade/preco). Itens sem nome, ou com quantidade inválida/<= 0, são descartados.
 * Usada pela consolidação de estoque e pelo dashboard para ambos lerem o mesmo formato.
 */
export function extrairItens(payload: unknown): ItemVenda[] {
  const raiz = comoObjeto(payload);
  // Aceita o envelope da API de pedidos ({ success, info: { items } }), `items`, `order.items` ou array na raiz
  const bruto = Array.isArray(payload)
    ? payload
    : (raiz?.items ?? comoObjeto(raiz?.order)?.items ?? comoObjeto(raiz?.info)?.items);
  if (!Array.isArray(bruto)) return [];

  const itens: ItemVenda[] = [];
  for (const entrada of bruto) {
    const item = comoObjeto(entrada);
    if (!item) continue;

    const nome = String(item.name || item.nome || '').trim();
    const quantidade = Number(item.quantity || item.quantidade || 0);
    const preco = Number(item.price || item.preco || item.unitPrice || 0);

    if (!nome || !Number.isFinite(quantidade) || quantidade <= 0) continue;
    itens.push({ nome, quantidade, preco: Number.isFinite(preco) && preco > 0 ? preco : 0 });
  }
  return itens;
}
