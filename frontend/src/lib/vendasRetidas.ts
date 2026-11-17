import axios from 'axios';
import { api } from './api';
import { formatarQuantidade } from './formatar';

export type TipoMotivoRetida =
  | 'PRODUTO_NAO_ENCONTRADO'
  | 'PRODUTO_SEM_FICHA'
  | 'ITEM_INVALIDO'
  | 'COLISAO_NOME'
  | 'SEM_ITENS';

export interface MotivoVendaRetida {
  tipo: TipoMotivoRetida | string;
  detalhe: string;
}

export interface VendaRetidaItem {
  id: string;
  externalId: string | null;
  criadoEm: string;
  check: number | null;
  motivos: MotivoVendaRetida[];
}

export interface ResumoProdutoRetido {
  produto: string;
  tipo: TipoMotivoRetida | string;
  vendas: number;
}

export interface VendasRetidasResposta {
  retidas: VendaRetidaItem[];
  resumoPorProduto: ResumoProdutoRetido[];
  aguardandoEstado: number;
  totalRetidas: number;
  totalPendentesAnalisadas: number;
  totalPendentes: number;
  limite: number;
  offset: number;
  temMais: boolean;
}

export interface AcaoVendaRetida {
  produto: string;
  tipo: TipoMotivoRetida | string;
}

const ROTULOS_MOTIVO: Record<string, string> = {
  PRODUTO_NAO_ENCONTRADO: 'Produto fora do catálogo',
  PRODUTO_SEM_FICHA: 'Produto sem ficha técnica',
  COLISAO_NOME: 'Colisão de nome no cardápio',
  ITEM_INVALIDO: 'Item inválido no pedido',
  SEM_ITENS: 'Pedido sem itens',
};

const ACOES_MOTIVO: Record<string, string> = {
  PRODUTO_NAO_ENCONTRADO: 'Criar produto',
  PRODUTO_SEM_FICHA: 'Montar ficha',
  COLISAO_NOME: 'Revisar produtos',
};

export function rotuloMotivoRetida(tipo: string): string {
  return ROTULOS_MOTIVO[tipo] ?? tipo;
}

export function rotuloAcaoRetida(tipo: string): string | null {
  return ACOES_MOTIVO[tipo] ?? null;
}

export function textoAcaoAcessivelRetida(tipo: string, produto: string): string | null {
  if (tipo === 'PRODUTO_NAO_ENCONTRADO') return `Criar produto ${produto}`;
  if (tipo === 'PRODUTO_SEM_FICHA') return `Montar ficha de ${produto}`;
  if (tipo === 'COLISAO_NOME') return `Revisar ${produto} no cardápio`;
  return null;
}

export function textoVendasContagem(qtd: number): string {
  return `${formatarQuantidade(qtd)} ${qtd === 1 ? 'venda' : 'vendas'}`;
}

export function textoTotalRetidas(qtd: number): string {
  return `${formatarQuantidade(qtd)} ${qtd === 1 ? 'venda retida' : 'vendas retidas'}`;
}

export function textoAguardandoEstado(qtd: number): string {
  return `${formatarQuantidade(qtd)} ${qtd === 1 ? 'pedido aguardando confirmação de status' : 'pedidos aguardando confirmação de status'}`;
}

export function normalizarRespostaRetidas(data: unknown): VendasRetidasResposta | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Partial<VendasRetidasResposta>;
  if (typeof obj.totalRetidas !== 'number' || !Number.isFinite(obj.totalRetidas)) {
    return null;
  }
  const retidas: VendaRetidaItem[] = Array.isArray(obj.retidas)
    ? obj.retidas
        .filter((item): item is VendaRetidaItem => Boolean(item) && typeof item === 'object')
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          externalId: typeof item.externalId === 'string' ? item.externalId : null,
          criadoEm: typeof item.criadoEm === 'string' ? item.criadoEm : '',
          check: typeof item.check === 'number' && Number.isFinite(item.check) ? item.check : null,
          motivos: Array.isArray(item.motivos) ? item.motivos : [],
        }))
    : [];

  return {
    retidas,
    resumoPorProduto: Array.isArray(obj.resumoPorProduto) ? obj.resumoPorProduto : [],
    aguardandoEstado: typeof obj.aguardandoEstado === 'number' && Number.isFinite(obj.aguardandoEstado) ? obj.aguardandoEstado : 0,
    totalRetidas: obj.totalRetidas,
    totalPendentesAnalisadas: typeof obj.totalPendentesAnalisadas === 'number' ? obj.totalPendentesAnalisadas : 0,
    totalPendentes: typeof obj.totalPendentes === 'number' ? obj.totalPendentes : 0,
    limite: typeof obj.limite === 'number' ? obj.limite : 200,
    offset: typeof obj.offset === 'number' ? obj.offset : 0,
    temMais: Boolean(obj.temMais),
  };
}

export function mesclarPaginasRetidas(
  acumulada: VendasRetidasResposta,
  proxima: VendasRetidasResposta,
): VendasRetidasResposta {
  const idsVistos = new Set(acumulada.retidas.map((r) => r.id));
  const retidas = [
    ...acumulada.retidas,
    ...proxima.retidas.filter((r) => !idsVistos.has(r.id)),
  ];

  const resumoPorProduto: ResumoProdutoRetido[] = [];
  const indicePorChave = new Map<string, number>();

  for (const item of [...acumulada.resumoPorProduto, ...proxima.resumoPorProduto]) {
    const chave = `${item.tipo}\0${item.produto}`;
    const idx = indicePorChave.get(chave);
    if (idx === undefined) {
      indicePorChave.set(chave, resumoPorProduto.length);
      resumoPorProduto.push({ ...item });
    } else {
      resumoPorProduto[idx] = {
        ...resumoPorProduto[idx],
        vendas: resumoPorProduto[idx].vendas + item.vendas,
      };
    }
  }

  return {
    retidas,
    resumoPorProduto,
    aguardandoEstado: acumulada.aguardandoEstado + proxima.aguardandoEstado,
    totalRetidas: acumulada.totalRetidas + proxima.totalRetidas,
    totalPendentesAnalisadas: acumulada.totalPendentesAnalisadas + proxima.totalPendentesAnalisadas,
    totalPendentes: proxima.totalPendentes,
    limite: proxima.limite,
    offset: proxima.offset,
    temMais: proxima.temMais,
  };
}

const MAX_PAGINAS_VARREDURA = 10;

/**
 * Busca vendas retidas na API e avança automaticamente enquanto a página atual tiver
 * `totalRetidas === 0` e `temMais === true` (até o limite de segurança), evitando que
 * vendas retidas fiquem ocultas atrás de uma primeira página apenas `aguardandoEstado`.
 */
export async function buscarVendasRetidas(): Promise<VendasRetidasResposta | null> {
  try {
    const resp = await api.get('/vendas/retidas');
    let acumulada = normalizarRespostaRetidas(resp.data);
    if (!acumulada) return null;

    let pagina = 1;
    while (acumulada.totalRetidas === 0 && acumulada.temMais && pagina < MAX_PAGINAS_VARREDURA) {
      const proximoOffset = acumulada.offset + Math.max(1, acumulada.limite);
      const proxResp = await api.get('/vendas/retidas', {
        params: { limite: acumulada.limite, offset: proximoOffset },
      });
      const proxima = normalizarRespostaRetidas(proxResp.data);
      if (!proxima || proxima.offset <= acumulada.offset) break;
      acumulada = mesclarPaginasRetidas(acumulada, proxima);
      pagina += 1;
    }

    return acumulada;
  } catch (error) {
    // 404 ocorre em ambientes/testes que não expõem/configuram esta rota secundária
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
