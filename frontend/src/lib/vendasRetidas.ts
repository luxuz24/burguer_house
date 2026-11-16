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
  return {
    retidas: Array.isArray(obj.retidas) ? obj.retidas : [],
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
