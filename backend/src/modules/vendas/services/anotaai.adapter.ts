/**
 * Adaptador unificado para mensagens e webhooks do Anota AI.
 *
 * Centraliza a extração defensiva de:
 * 1. Identificador de pedido / idempotência (`externalId`);
 * 2. Estado do ciclo de vida (`check` / `destino`);
 * 3. Itens e modificadores (`subItems`), com diagnóstico de itens inválidos;
 * 4. Normalização canônica de nomes de produtos do cardápio.
 */

export type DestinoVenda = 'abater' | 'ignorar' | 'aguardar';

export interface ItemVenda {
  nome: string;
  quantidade: number;
  preco: number;
  subItens?: ItemVenda[];
}

export interface ItemInvalido {
  itemBruto: unknown;
  motivo: string;
}

export interface ResultadoExtracaoItens {
  itens: ItemVenda[];
  itensInvalidos: ItemInvalido[];
}

export interface ResultadoParseAnotaAI {
  valido: boolean;
  externalId: string | null;
  check: number | null;
  destino: DestinoVenda;
  itens: ItemVenda[];
  itensInvalidos: ItemInvalido[];
  motivoInvalido?: string | undefined;
}

const ESTADOS_QUE_ABATEM = new Set([1, 2, 3]);
const ESTADOS_QUE_NAO_ABATEM = new Set([4, 5, -4, 41, 42]);

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

function comoObjeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

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

export { normalizarNomeProduto } from '../../../shared/nomes.js';

export class AnotaAIAdapter {
  /**
   * Extrai o identificador do pedido.
   * Prioriza identificadores dentro de envelopes específicos (`order`, `info`, `pedido`, `data`)
   * antes do `id` genérico da raiz, evitando confundir IDs de transmissão/evento na raiz com o ID real do pedido.
   * Se o payload não tiver ID explícito, utiliza os headers de idempotência como fallback.
   */
  extrairIdExterno(payload: unknown, headers?: Record<string, unknown>): string | null {
    const raiz = comoObjeto(payload);
    if (raiz) {
      // 1. Prioridade: sub-containers que representam explicitamente o pedido
      for (const chave of CONTAINERS_PEDIDO) {
        const sub = raiz[chave];
        if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
          const idSub = extrairDeObjeto(sub as Record<string, unknown>);
          if (idSub) return idSub;
        }
      }

      // 2. ID na raiz do payload
      const idRaiz = extrairDeObjeto(raiz);
      if (idRaiz) return idRaiz;
    }

    // 3. Fallback: headers de idempotência (case-insensitive)
    if (headers && typeof headers === 'object') {
      const headersMin = new Map<string, unknown>();
      for (const [k, v] of Object.entries(headers)) {
        headersMin.set(k.toLowerCase(), v);
      }
      for (const h of HEADERS_IDEMPOTENCIA) {
        const valorHeader = headersMin.get(h);
        const id = normalizarId(Array.isArray(valorHeader) ? valorHeader[0] : valorHeader);
        if (id) return id;
      }
    }

    return null;
  }

  /**
   * Lê o estado do pedido (campo `check`) na raiz, no envelope `info` ou `order`.
   * Rejeita valores não numéricos (como booleanos ou arrays) para evitar coerção espúria.
   */
  extrairEstadoPedido(payload: unknown): number | null {
    const raiz = comoObjeto(payload);
    if (!raiz) return null;

    for (const candidato of [comoObjeto(raiz.info), comoObjeto(raiz.order), raiz]) {
      const bruto = candidato?.check;
      if (typeof bruto !== 'number' && typeof bruto !== 'string') continue;
      if (typeof bruto === 'string' && bruto.trim() === '') continue;
      const numero = Number(bruto);
      if (Number.isFinite(numero)) return numero;
    }
    return null;
  }

  /**
   * Classifica a venda para fins de consolidação de estoque:
   * - 'abater': pedido confirmado/aceito (check 1, 2, 3);
   * - 'ignorar': pedido cancelado/negado (check 4, 5, -4, 41, 42);
   * - 'aguardar': pedido pendente (check 0, -2, -1, -3, 6) OU payload sem check (fail-safe).
   */
  classificarVenda(payload: unknown): DestinoVenda {
    const estado = this.extrairEstadoPedido(payload);
    if (estado === null) return 'aguardar';
    if (ESTADOS_QUE_ABATEM.has(estado)) return 'abater';
    if (ESTADOS_QUE_NAO_ABATEM.has(estado)) return 'ignorar';
    return 'aguardar';
  }

  /**
   * Extrai os itens válidos e registra qualquer item malformado (sem nome ou com quantidade inválida/ausente).
   * Isso impede que uma venda seja consumida pela metade caso contenha itens ilegíveis.
   */
  extrairItensComDiagnostico(payload: unknown): ResultadoExtracaoItens {
    const raiz = comoObjeto(payload);
    const bruto = Array.isArray(payload)
      ? payload
      : (comoObjeto(raiz?.info)?.items ?? comoObjeto(raiz?.order)?.items ?? raiz?.items);
    if (!Array.isArray(bruto)) return { itens: [], itensInvalidos: [] };

    const itens: ItemVenda[] = [];
    const itensInvalidos: ItemInvalido[] = [];

    const extrairLista = (lista: unknown[]): ItemVenda[] => {
      const res: ItemVenda[] = [];
      for (const entrada of lista) {
        const item = comoObjeto(entrada);
        if (!item) {
          itensInvalidos.push({ itemBruto: entrada, motivo: 'Entrada não é um objeto válido' });
          continue;
        }

        const nome = String(item.name ?? item.nome ?? '').trim();
        const qtdBruta = item.quantity ?? item.quantidade;
        const prcBruto = item.price ?? item.preco ?? item.unitPrice;

        if (!nome) {
          itensInvalidos.push({ itemBruto: entrada, motivo: 'Item sem nome' });
          continue;
        }

        const quantidade =
          typeof qtdBruta === 'number' || (typeof qtdBruta === 'string' && qtdBruta.trim() !== '')
            ? Number(qtdBruta)
            : 0;

        if (!Number.isFinite(quantidade) || quantidade <= 0) {
          itensInvalidos.push({ itemBruto: entrada, motivo: 'Item sem quantidade válida ou menor/igual a zero' });
          continue;
        }

        const preco =
          typeof prcBruto === 'number' || (typeof prcBruto === 'string' && prcBruto.trim() !== '')
            ? Number(prcBruto)
            : 0;

        const subListaBruta = item.subItems ?? item.adicionais ?? item.complementos;
        const subItens = Array.isArray(subListaBruta) ? extrairLista(subListaBruta) : [];

        const itemFinal: ItemVenda = {
          nome,
          quantidade,
          preco: Number.isFinite(preco) && preco > 0 ? preco : 0,
        };
        if (subItens.length > 0) {
          itemFinal.subItens = subItens;
        }

        res.push(itemFinal);
      }
      return res;
    };

    itens.push(...extrairLista(bruto));
    return { itens, itensInvalidos };
  }

  /**
   * Extrai defensivamente apenas os itens válidos (compatibilidade com chamadores antigos).
   */
  extrairItens(payload: unknown): ItemVenda[] {
    return this.extrairItensComDiagnostico(payload).itens;
  }

  /**
   * Executa a análise completa do payload e retorna estrutura tipada com diagnóstico de itens inválidos.
   */
  parsear(payload: unknown, headers?: Record<string, unknown>): ResultadoParseAnotaAI {
    const externalId = this.extrairIdExterno(payload, headers);
    const check = this.extrairEstadoPedido(payload);
    const destino = this.classificarVenda(payload);
    const { itens, itensInvalidos } = this.extrairItensComDiagnostico(payload);

    return {
      valido: typeof payload === 'object' && payload !== null,
      externalId,
      check,
      destino,
      itens,
      itensInvalidos,
      motivoInvalido: typeof payload !== 'object' || payload === null ? 'Payload não é um objeto JSON' : undefined,
    };
  }
}
