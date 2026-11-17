import { normalizarBusca } from './formatar';

export type CategoriaInsumo = 'INGREDIENTE' | 'EMBALAGEM' | 'BEBIDA';

export interface ProdutoFechamento {
  id: string;
  nome: string;
}

export interface ConsumoSimulacao {
  insumoId: string;
  nome: string;
  unidade: string;
  categoria: CategoriaInsumo;
  consumo: number;
  estoqueAtual: number;
  estoqueProjetado: number;
  ficariaNegativo: boolean;
}

export interface ResultadoSimulacao {
  data: string;
  itens: Array<{ produtoId: string; nome: string; quantidade: number }>;
  consumos: ConsumoSimulacao[];
  produtosSemFicha: Array<{ produtoId: string; nome: string }>;
  temNegativo: boolean;
  podeConfirmar: boolean;
}

export const QUANTIDADE_MAXIMA = 500;

/** Produtos internos (ex.: "PRODUÇÃO: Maionese da Casa") não são vendidos ao cliente. Regra única, isolada aqui. */
export function ehProdutoInterno(nome: string): boolean {
  return /^producao\s*:/.test(normalizarBusca(nome));
}

export function filtrarProdutosVendaveis<T extends { nome: string }>(produtos: T[]): T[] {
  return produtos.filter((p) => !ehProdutoInterno(p.nome));
}

/** Inteiro de 0 a 500; texto com lixo e valores inválidos viram 0 (ou o prefixo numérico). */
export function limitarQuantidade(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10);
  if (!Number.isFinite(numero)) return 0;
  return Math.min(QUANTIDADE_MAXIMA, Math.max(0, Math.trunc(numero)));
}

export function resumoFechamento(quantidades: Record<string, number>): { produtos: number; unidades: number } {
  let produtos = 0;
  let unidades = 0;
  for (const q of Object.values(quantidades)) {
    if (q > 0) {
      produtos += 1;
      unidades += q;
    }
  }
  return { produtos, unidades };
}

export function itensParaSimulacao(quantidades: Record<string, number>): Array<{ produtoId: string; quantidade: number }> {
  return Object.entries(quantidades)
    .filter(([, q]) => q > 0)
    .map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

/** Identifica o que foi simulado; se mudar depois, o impacto exibido está obsoleto. */
export function chaveSimulacao(data: string, quantidades: Record<string, number>): string {
  const itens = itensParaSimulacao(quantidades).sort((a, b) => a.produtoId.localeCompare(b.produtoId));
  return JSON.stringify({ data, itens });
}

const ROTULO_CATEGORIA: Record<CategoriaInsumo, string> = {
  INGREDIENTE: 'Ingredientes',
  EMBALAGEM: 'Embalagens',
  BEBIDA: 'Bebidas',
};
const ORDEM_CATEGORIA: CategoriaInsumo[] = ['INGREDIENTE', 'EMBALAGEM', 'BEBIDA'];

export interface GrupoImpacto {
  categoria: CategoriaInsumo;
  rotulo: string;
  itens: ConsumoSimulacao[];
}

/** Os que ficariam negativos vêm separados e primeiro; o resto fica agrupado por categoria. */
export function agruparImpacto(consumos: ConsumoSimulacao[]): { negativos: ConsumoSimulacao[]; grupos: GrupoImpacto[] } {
  const negativos = consumos.filter((c) => c.ficariaNegativo);
  const grupos: GrupoImpacto[] = ORDEM_CATEGORIA.map((categoria) => ({
    categoria,
    rotulo: ROTULO_CATEGORIA[categoria],
    itens: [] as ConsumoSimulacao[],
  }));
  for (const c of consumos) {
    if (c.ficariaNegativo) continue;
    const grupo = grupos.find((g) => g.categoria === c.categoria) ?? grupos[0];
    grupo.itens.push(c);
  }
  return { negativos, grupos: grupos.filter((g) => g.itens.length > 0) };
}
