import axios from 'axios';
import { mensagemDeErro } from './api';
import { TIMEZONE_LOJA, normalizarBusca } from './formatar';

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

export interface FechamentoListado {
  id: string;
  externalId: string | null;
  criadoEm: string;
  ocorridoEm: string;
  observacao: string | null;
  itens: Array<{ nome: string; quantidade: number }>;
  usuario: { id: string; nome: string } | null;
  estornada: boolean;
  estorno: { em: string; motivo: string; usuario: { id: string; nome: string } | null } | null;
}

export interface ListagemFechamentos {
  data: string;
  total: number;
  fechamentos: FechamentoListado[];
}

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE_LOJA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "18:41" no fuso da loja; data inválida vira "—". */
export function formatarHoraLoja(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : formatadorHora.format(d);
}

export function textoItensFechamento(itens: Array<{ nome: string; quantidade: number }>): string {
  return itens.length === 0 ? 'Sem itens' : itens.map((i) => `${i.quantidade}× ${i.nome}`).join(' · ');
}

export function fechamentosAtivos(lista: FechamentoListado[]): FechamentoListado[] {
  return lista.filter((f) => !f.estornada);
}

/** Aviso contra lançar o mesmo dia duas vezes; não bloqueia (pode haver dois turnos). */
export function textoAvisoDiaJaFechado(ativos: FechamentoListado[]): string | null {
  if (ativos.length === 0) return null;
  const unidades = ativos.reduce((soma, f) => soma + f.itens.reduce((s, i) => s + i.quantidade, 0), 0);
  const fechamentos = `${ativos.length} ${ativos.length === 1 ? 'fechamento' : 'fechamentos'}`;
  const itens = `${unidades} ${unidades === 1 ? 'item' : 'itens'}`;
  return `Este dia já tem ${fechamentos} (${itens}). Lançar outro soma ${ativos.length === 1 ? 'ao anterior' : 'aos anteriores'}.`;
}

function normalizarFechamento(bruto: unknown): FechamentoListado | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const f = bruto as Partial<FechamentoListado>;
  const usuario = (u: unknown) =>
    u && typeof u === 'object' && typeof (u as { nome?: unknown }).nome === 'string'
      ? { id: String((u as { id?: unknown }).id ?? ''), nome: (u as { nome: string }).nome }
      : null;
  const est = f.estorno && typeof f.estorno === 'object' ? f.estorno : null;
  return {
    id: typeof f.id === 'string' ? f.id : '',
    externalId: typeof f.externalId === 'string' ? f.externalId : null,
    criadoEm: typeof f.criadoEm === 'string' ? f.criadoEm : '',
    ocorridoEm: typeof f.ocorridoEm === 'string' ? f.ocorridoEm : '',
    observacao: typeof f.observacao === 'string' && f.observacao.trim() ? f.observacao : null,
    itens: Array.isArray(f.itens)
      ? f.itens.filter((i) => i && typeof i.nome === 'string').map((i) => ({ nome: i.nome, quantidade: Number(i.quantidade) || 0 }))
      : [],
    usuario: usuario(f.usuario),
    estornada: Boolean(f.estornada) || est !== null,
    estorno: est
      ? { em: String(est.em ?? ''), motivo: String(est.motivo ?? ''), usuario: usuario(est.usuario) }
      : null,
  };
}

/** Resposta fora do formato vira lista vazia (a tela nunca quebra por dado inesperado). */
export function normalizarListagem(resposta: unknown): ListagemFechamentos {
  const obj = resposta && typeof resposta === 'object' && !Array.isArray(resposta) ? (resposta as Partial<ListagemFechamentos>) : {};
  const fechamentos = (Array.isArray(obj.fechamentos) ? obj.fechamentos : [])
    .map(normalizarFechamento)
    .filter((f): f is FechamentoListado => f !== null);
  return { data: typeof obj.data === 'string' ? obj.data : '', total: fechamentos.length, fechamentos };
}

