import axios from 'axios';
import { mensagemDeErro } from './api';
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

export interface ResultadoConfirmacao {
  reaproveitado: boolean;
  vendaId: string;
  externalId: string;
  chaveIdempotencia: string;
  data: string;
  ocorridoEm: string;
  itens: Array<{ produtoId: string; nome: string; quantidade: number }>;
  consumos: Array<{ insumoId: string; nome: string; unidade: string; quantidade: number }>;
  insumosComEstoqueNegativo: Array<{ id: string; nome: string; estoqueAtual: number }>;
}

export interface ResultadoEstorno {
  vendaId: string;
  estornada: boolean;
  estorno: { usuarioId: string | null; em: string; motivo: string };
  devolucoes: Array<{ insumoId: string; nome: string; unidade: string; quantidade: number; estoqueAtual: number }>;
}

/** "2026-11-13" -> "13/11"; texto fora do formato volta como veio. */
export function formatarDiaCurto(data: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(data);
  return m ? `${m[2]}/${m[1]}` : data;
}

export function textoConfirmacaoBaixa(unidades: number, data: string, temNegativo: boolean): string {
  const base = `Dar baixa de ${unidades} ${unidades === 1 ? 'item' : 'itens'} do dia ${formatarDiaCurto(data)}? O estoque será reduzido.`;
  return temNegativo ? `${base} Atenção: algum insumo ficará negativo.` : base;
}

export type ErroConfirmacao =
  | { tipo: 'conflito' }
  | { tipo: 'validacao'; mensagem: string; produtosSemFicha: string[]; produtosNaoEncontrados: string[] }
  | { tipo: 'rede' }
  | { tipo: 'outro'; mensagem: string };

/** Falha de rede e 5xx mantêm a chave (a baixa pode ou não ter passado); 409 troca a chave; 422 detalha os produtos. */
export function classificarErroConfirmacao(error: unknown): ErroConfirmacao {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response || (status !== undefined && status >= 500)) return { tipo: 'rede' };
    if (status === 409) return { tipo: 'conflito' };
    if (status === 422) {
      const dados = error.response.data as {
        produtosSemFicha?: Array<{ nome?: unknown }>;
        produtosNaoEncontrados?: unknown[];
      } | undefined;
      return {
        tipo: 'validacao',
        mensagem: mensagemDeErro(error, 'Não é possível confirmar o fechamento.'),
        produtosSemFicha: (dados?.produtosSemFicha ?? []).map((p) => String(p.nome ?? '')).filter(Boolean),
        produtosNaoEncontrados: (dados?.produtosNaoEncontrados ?? []).map(String),
      };
    }
  }
  return { tipo: 'outro', mensagem: mensagemDeErro(error, 'Não foi possível confirmar o fechamento.') };
}
