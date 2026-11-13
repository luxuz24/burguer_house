/**
 * Sanitiza payloads brutos de pedidos (ex.: webhook Anota AI) por LISTA DE CAMPOS PERMITIDOS (allowlist).
 *
 * Política de segurança (falha segura): qualquer campo desconhecido ou não listado
 * explicitamente abaixo é REMOVIDO na saída. Campos de texto livre do cliente
 * (`observation`, `note`) nunca têm seu conteúdo copiado — quando preenchidos, são
 * substituídos pelo marcador `"<observacao-removida>"`.
 */

const MARCADOR_OBSERVACAO_REMOVIDA = '<observacao-removida>';

const CAMPOS_PEDIDO_PRIMITIVOS = [
  'id',
  '_id',
  'check',
  'shortReference',
  'type',
  'salesChannel',
  'createdAt',
  'updatedAt',
  'total',
  'deliveryFee',
] as const;

const CAMPOS_SCHEDULE_ORDER = ['date', 'start', 'end', 'timezone'] as const;
const CAMPOS_PAGAMENTO = ['name', 'code', 'prepaid'] as const;
const CAMPOS_DESCONTO = ['tag', 'amount', 'target'] as const;

const CAMPOS_ITEM_PRIMITIVOS = [
  'id',
  'name',
  'quantity',
  'price',
  'total',
  'externalId',
  'internalId',
  'externalCode',
] as const;

const CAMPOS_SUBITEM_PRIMITIVOS = [
  'name',
  'quantity',
  'price',
  'total',
  'externalCode',
  'quantityFraction',
  'valueFraction',
] as const;

const CAMPOS_TEXTO_LIVRE = ['observation', 'note'] as const;

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function ehPrimitivoSeguro(valor: unknown): valor is string | number | boolean {
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean';
}

function copiarCamposPrimitivos(
  origem: Record<string, unknown>,
  camposPermitidos: readonly string[],
): Record<string, unknown> {
  const destino: Record<string, unknown> = {};
  for (const campo of camposPermitidos) {
    const valor = origem[campo];
    if (ehPrimitivoSeguro(valor)) {
      destino[campo] = valor;
    }
  }
  return destino;
}

function copiarRedacaoTextoLivre(
  origem: Record<string, unknown>,
  destino: Record<string, unknown>,
): void {
  for (const campo of CAMPOS_TEXTO_LIVRE) {
    const valor = origem[campo];
    if (typeof valor === 'string' && valor.trim().length > 0) {
      destino[campo] = MARCADOR_OBSERVACAO_REMOVIDA;
    }
  }
}

function sanitizarListaObjetos(
  valor: unknown,
  sanitizador: (entrada: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown>[] | undefined {
  if (!Array.isArray(valor)) {
    return undefined;
  }
  return valor.filter(ehObjetoPlano).map(sanitizador);
}

function sanitizarSubItem(subItem: Record<string, unknown>): Record<string, unknown> {
  const saida = copiarCamposPrimitivos(subItem, CAMPOS_SUBITEM_PRIMITIVOS);
  copiarRedacaoTextoLivre(subItem, saida);
  return saida;
}

function sanitizarItem(item: Record<string, unknown>): Record<string, unknown> {
  const saida = copiarCamposPrimitivos(item, CAMPOS_ITEM_PRIMITIVOS);
  copiarRedacaoTextoLivre(item, saida);

  const subItems = sanitizarListaObjetos(item.subItems, sanitizarSubItem);
  if (subItems !== undefined) {
    saida.subItems = subItems;
  }

  return saida;
}

function sanitizarPedido(pedido: Record<string, unknown>): Record<string, unknown> {
  const saida = copiarCamposPrimitivos(pedido, CAMPOS_PEDIDO_PRIMITIVOS);
  copiarRedacaoTextoLivre(pedido, saida);

  if (ehObjetoPlano(pedido.schedule_order)) {
    saida.schedule_order = copiarCamposPrimitivos(pedido.schedule_order, CAMPOS_SCHEDULE_ORDER);
  }

  const payments = sanitizarListaObjetos(pedido.payments, (p) =>
    copiarCamposPrimitivos(p, CAMPOS_PAGAMENTO),
  );
  if (payments !== undefined) {
    saida.payments = payments;
  }

  const discounts = sanitizarListaObjetos(pedido.discounts, (d) =>
    copiarCamposPrimitivos(d, CAMPOS_DESCONTO),
  );
  if (discounts !== undefined) {
    saida.discounts = discounts;
  }

  const items = sanitizarListaObjetos(pedido.items, sanitizarItem);
  if (items !== undefined) {
    saida.items = items;
  }

  if (ehObjetoPlano(pedido.info)) {
    saida.info = sanitizarPedido(pedido.info);
  }

  if (ehObjetoPlano(pedido.order)) {
    saida.order = sanitizarPedido(pedido.order);
  }

  return saida;
}

export function anonimizarPayloadVenda(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.filter(ehObjetoPlano).map(sanitizarPedido);
  }
  if (ehObjetoPlano(valor)) {
    return sanitizarPedido(valor);
  }
  return {};
}
