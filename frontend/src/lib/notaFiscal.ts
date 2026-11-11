/**
 * Regras puras da entrada por nota fiscal (ImportarNotaFiscal.tsx): tipos do contrato
 * (docs/api.md §8), mapeamento inicial dos itens lidos e montagem do payload de confirmação.
 */

export interface SugestaoAlternativa {
  insumoId: string;
  insumoNome: string;
  unidade: string;
  confianca: number;
}

export type MotivoMatch = 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM';

export interface ItemNFeExtraido {
  itemNumero: number;
  codigo: string;
  descricao: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  valorTotal: number;
  sugestaoInsumoId: string | null;
  sugestaoInsumoNome: string | null;
  sugestaoUnidadeInsumo: string | null;
  fatorConversaoSugerido: number;
  quantidadeConvertidaSugerida: number;
  conversaoIncerta?: boolean;
  erro?: string;
  confiancaMatch?: number;
  motivoMatch?: MotivoMatch;
  outrasSugestoes?: SugestaoAlternativa[];
}

export interface NFeParseada {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedor: {
    nome: string;
    cnpjCpf: string;
  };
  valorTotal: number;
  erroValorTotal?: string;
  totalItensComErro?: number;
  itens: ItemNFeExtraido[];
}

export interface ItemMapeado {
  itemNumero: number;
  descricao: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  incluir: boolean;
  insumoId: string;
  fatorConversao: number;
  conversaoIncerta?: boolean;
  erro?: string;
  confiancaMatch?: number;
  motivoMatch?: MotivoMatch;
  outrasSugestoes?: SugestaoAlternativa[];
}

export interface ItemParaSalvar {
  insumoId: string;
  quantidade: number;
  valorUnitario: number;
  descricaoOriginal: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorTotal: number;
}

/** Converte os itens lidos da nota (XML ou QR code) no estado editável da revisão. */
export function mapearItensIniciais(itens: ItemNFeExtraido[]): ItemMapeado[] {
  return itens.map((it) => ({
    itemNumero: it.itemNumero,
    descricao: it.descricao,
    unidadeOriginal: it.unidadeOriginal,
    quantidadeOriginal: it.quantidadeOriginal,
    valorUnitario: it.valorUnitario,
    incluir: !it.erro && !!it.sugestaoInsumoId,
    insumoId: it.sugestaoInsumoId || '',
    fatorConversao: it.fatorConversaoSugerido || 1,
    conversaoIncerta: it.conversaoIncerta,
    erro: it.erro,
    confiancaMatch: it.confiancaMatch,
    motivoMatch: it.motivoMatch,
    outrasSugestoes: it.outrasSugestoes,
  }));
}

/** Itens do payload de POST /notas-fiscais/confirmar. */
export function montarItensParaSalvar(itens: ItemMapeado[]): ItemParaSalvar[] {
  return itens
    .filter((it) => it.incluir && it.insumoId && (it.quantidadeOriginal * it.fatorConversao) > 0)
    .map((it) => ({
      insumoId: it.insumoId,
      quantidade: it.quantidadeOriginal * it.fatorConversao,
      valorUnitario: it.valorUnitario / (it.fatorConversao || 1),
      descricaoOriginal: it.descricao,
      unidadeOriginal: it.unidadeOriginal,
      quantidadeOriginal: it.quantidadeOriginal,
      valorTotal: it.quantidadeOriginal * it.valorUnitario,
    }));
}
