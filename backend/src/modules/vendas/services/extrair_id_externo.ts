const CAMPOS_ID_PEDIDO = [
  'externalId',
  'external_id',
  'orderId',
  'order_id',
  'pedidoId',
  'pedido_id',
  'id',
  '_id',
] as const;

const CONTAINERS_PEDIDO = ['order', 'pedido', 'data', 'info'] as const;

const HEADERS_IDEMPOTENCIA = ['x-webhook-id', 'x-event-id', 'x-idempotency-key'] as const;

function normalizarId(valor: unknown): string | null {
  if (typeof valor === 'string') {
    const limpo = valor.trim();
    return limpo.length > 0 && limpo.length <= 255 ? limpo : null;
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return String(valor);
  }
  return null;
}

function extrairDeObjeto(obj: Record<string, unknown>): string | null {
  for (const campo of CAMPOS_ID_PEDIDO) {
    const id = normalizarId(obj[campo]);
    if (id) return id;
  }
  return null;
}

/**
 * Extrai o identificador único do pedido/evento a partir dos headers ou do payload
 * enviado pela Anota AI (suporta formatos variados: raiz, `order.*`, `pedido.*`, `data.*`, `info.*`).
 * Retorna `null` quando nenhum identificador explícito está presente.
 */
export function extrairIdExterno(
  payload: unknown,
  headers?: Record<string, unknown>,
): string | null {
  if (headers && typeof headers === 'object') {
    for (const h of HEADERS_IDEMPOTENCIA) {
      const valorHeader = headers[h];
      const id = normalizarId(Array.isArray(valorHeader) ? valorHeader[0] : valorHeader);
      if (id) return id;
    }
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const raiz = payload as Record<string, unknown>;
  const idRaiz = extrairDeObjeto(raiz);
  if (idRaiz) return idRaiz;

  for (const chave of CONTAINERS_PEDIDO) {
    const sub = raiz[chave];
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      const idSub = extrairDeObjeto(sub as Record<string, unknown>);
      if (idSub) return idSub;
    }
  }

  return null;
}
