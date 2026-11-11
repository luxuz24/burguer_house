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
  /** ISO 8601. Pode faltar (fallback da SEFAZ sem data na chave). */
  dataEmissao?: string;
  /** true quando a data veio do ano/mês da chave de acesso (dia 1), não da nota. */
  dataEmissaoAproximada?: boolean;
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
  /** Fator numérico em uso; NaN enquanto o texto digitado não for um número maior que zero. */
  fatorConversao: number;
  /** O que o operador digitou no campo do fator (aceita vírgula e estados intermediários como "0,"). */
  fatorTexto: string;
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
    fatorTexto: formatarFator(it.fatorConversaoSugerido || 1),
    conversaoIncerta: it.conversaoIncerta,
    erro: it.erro,
    confiancaMatch: it.confiancaMatch,
    motivoMatch: it.motivoMatch,
    outrasSugestoes: it.outrasSugestoes,
  }));
}

/** Limite do backend para o XML (docs/api.md §8: 500 KB = 512.000 caracteres). */
export const LIMITE_XML_CARACTERES = 512_000;

/** Fator no formato do campo (vírgula decimal, sem separador de milhar): 0.001 → "0,001". */
export function formatarFator(fator: number): string {
  return String(fator).replace('.', ',');
}

/**
 * Lê o fator digitado. Aceita vírgula ou ponto decimal; devolve null para vazio, zero, negativo,
 * texto ou valores não finitos (ex.: "1e999"), que não podem virar entrada de estoque.
 */
export function parsearFator(texto: string): number | null {
  const normalizado = texto.trim().replace(',', '.');
  if (!normalizado) return null;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** O item aponta para um insumo que existe na lista carregada (sugestão de insumo excluído não conta). */
export function estaVinculado(item: ItemMapeado, idsInsumos: ReadonlySet<string>): boolean {
  return item.insumoId !== '' && idsInsumos.has(item.insumoId);
}

export interface PendenciasConfirmacao {
  /** Marcados para entrar, mas sem insumo válido: bloqueiam a confirmação. */
  semVinculo: ItemMapeado[];
  /** Vinculados com fator inválido: bloqueiam a confirmação. */
  fatorInvalido: ItemMapeado[];
  /** Vinculados com conversão 1:1 incerta: pedem confirmação explícita. */
  conversaoIncerta: ItemMapeado[];
}

export function pendenciasDaConfirmacao(
  itens: ItemMapeado[],
  idsInsumos: ReadonlySet<string>,
): PendenciasConfirmacao {
  const incluidos = itens.filter((it) => it.incluir);
  const vinculados = incluidos.filter((it) => estaVinculado(it, idsInsumos));
  return {
    semVinculo: incluidos.filter((it) => !estaVinculado(it, idsInsumos)),
    fatorInvalido: vinculados.filter((it) => !(Number.isFinite(it.fatorConversao) && it.fatorConversao > 0)),
    conversaoIncerta: vinculados.filter((it) => it.conversaoIncerta === true),
  };
}

/** Texto do bloqueio da confirmação (telas.html#nf2: "Vincule 1 item para continuar (ou ignore-o)."). */
export function textoPendencias({ semVinculo, fatorInvalido }: PendenciasConfirmacao): string[] {
  const textos: string[] = [];
  if (semVinculo.length === 1) textos.push('Vincule 1 item para continuar (ou ignore-o).');
  else if (semVinculo.length > 1) textos.push(`Vincule ${semVinculo.length} itens para continuar (ou ignore-os).`);
  if (fatorInvalido.length === 1) textos.push('Corrija o fator de conversão de 1 item.');
  else if (fatorInvalido.length > 1) textos.push(`Corrija o fator de conversão de ${fatorInvalido.length} itens.`);
  return textos;
}

const TIMEZONE_LOJA = 'America/Campo_Grande';
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_HORA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Devolve a data de emissão se for ISO 8601 válida; senão undefined (o backend usa a data de hoje). */
export function dataEmissaoValida(iso: string | null | undefined): string | undefined {
  if (typeof iso !== 'string') return undefined;
  const texto = iso.trim();
  if (!SO_DATA.test(texto) && !DATA_HORA_ISO.test(texto)) return undefined;
  return Number.isNaN(new Date(texto).getTime()) ? undefined : texto;
}

/**
 * Data de emissão para o resumo da nota, no fuso da loja.
 * Só data ("2026-10-10", NF-e 2.0) é lida como dia civil, sem conversão de fuso.
 * Aproximada (pela chave de acesso) mostra só mês/ano, que é o que a chave informa.
 */
export function textoDataEmissao(iso: string | null | undefined, aproximada = false): string {
  const valida = dataEmissaoValida(iso);
  if (!valida) return 'Emissão não informada';
  const soData = SO_DATA.exec(valida);
  let dia: string;
  let mes: string;
  let ano: string;
  if (soData) {
    [, ano, mes, dia] = soData as unknown as [string, string, string, string];
  } else {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE_LOJA,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date(valida));
    dia = partes.find((p) => p.type === 'day')?.value ?? '';
    mes = partes.find((p) => p.type === 'month')?.value ?? '';
    ano = partes.find((p) => p.type === 'year')?.value ?? '';
  }
  return aproximada
    ? `Emissão: ${mes}/${ano} (aproximada pela chave de acesso)`
    : `Emissão: ${dia}/${mes}/${ano}`;
}

/** Número para um item adicionado à mão: nunca repete o de um item existente (mesmo após remoções). */
export function proximoItemNumero(itens: ItemMapeado[]): number {
  return itens.reduce((maior, it) => Math.max(maior, it.itemNumero), 0) + 1;
}

/** Itens do payload de POST /notas-fiscais/confirmar. */
export function montarItensParaSalvar(itens: ItemMapeado[], idsInsumos: ReadonlySet<string>): ItemParaSalvar[] {
  return itens
    .filter((it) => it.incluir && estaVinculado(it, idsInsumos) && (it.quantidadeOriginal * it.fatorConversao) > 0)
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
