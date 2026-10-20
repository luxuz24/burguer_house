/**
 * Estado do pedido na Anota AI (campo `check`). O webhook avisa MUDANÇAS de estado de um mesmo pedido
 * (aceito, atualizado, cancelado), então o estoque só pode ser abatido conforme o estado em que o pedido está.
 *
 *   0 em análise · 1 em produção · 2 pronto · 3 finalizado · 4 cancelado · 5 negado (15 min sem aceite)
 *   -2 agendado aceito · 6 solicitação de cancelamento · -1/-3 aguardando pagamento/criado · -4 rejeitado · 41/42 cancelado/expirado
 */
export type DestinoVenda = 'abater' | 'ignorar' | 'aguardar';

const ESTADOS_QUE_ABATEM = new Set([1, 2, 3]);
const ESTADOS_QUE_NAO_ABATEM = new Set([4, 5, -4, 41, 42]);

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

/** Lê o `check` do payload (raiz, `info.check` do envelope da API ou `order.check`). Retorna null se não houver. */
export function extrairEstadoPedido(payload: unknown): number | null {
  const raiz = comoObjeto(payload);
  if (!raiz) return null;

  for (const candidato of [raiz, comoObjeto(raiz.info), comoObjeto(raiz.order)]) {
    const bruto = candidato?.check;
    if (bruto === undefined || bruto === null || bruto === '') continue;
    const numero = Number(bruto);
    if (Number.isFinite(numero)) return numero;
  }
  return null;
}

/**
 * - abater: pedido aceito (1, 2 ou 3), ou payload sem `check` (formato desconhecido: comportamento anterior);
 * - ignorar: cancelado/negado/rejeitado/expirado; é marcado como processado sem tocar no estoque;
 * - aguardar: ainda não aceito ou agendado (0, -2, -1, -3, 6) ou estado desconhecido; fica pendente
 *   para a próxima consolidação, quando um novo evento já deve ter atualizado o estado.
 */
export function classificarVenda(payload: unknown): DestinoVenda {
  const estado = extrairEstadoPedido(payload);
  if (estado === null) return 'abater';
  if (ESTADOS_QUE_ABATEM.has(estado)) return 'abater';
  if (ESTADOS_QUE_NAO_ABATEM.has(estado)) return 'ignorar';
  return 'aguardar';
}
