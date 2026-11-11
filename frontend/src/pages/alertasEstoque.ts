import { textoValidade } from '../lib/formatar';

/**
 * Item de `estoqueAlerta` de GET /api/dashboard/resumo (dashboard.service.ts:342-371).
 * O backend põe na lista tanto o estoque baixo quanto a validade curta; `diasRestantesValidade` e
 * `vencido` só vêm quando a validade é o motivo do alerta (vence em até 2 dias ou já venceu).
 */
export interface AlertaEstoque {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  status: 'CRITICO' | 'ALERTA';
  percentualEstoque: number;
  diasRestantesValidade?: number | null;
  vencido?: boolean | null;
}

export type TipoAlerta = 'vencido' | 'vencendo' | 'estoque';

/** Dias até vencer, ou null quando o campo não veio (ou veio null/NaN): a validade não é o motivo do alerta. */
export function diasDeValidade(item: Pick<AlertaEstoque, 'diasRestantesValidade'>): number | null {
  const dias = item.diasRestantesValidade;
  return typeof dias === 'number' && Number.isFinite(dias) ? dias : null;
}

/**
 * Motivo do alerta. A validade tem prioridade: comprar mais de um insumo que está vencendo seria o
 * conselho errado. Vencido segue a regra do backend (dashboard.service.ts:78: `diasRestantes <= 0`),
 * mesmo que a flag `vencido` não venha.
 */
export function tipoAlerta(item: Pick<AlertaEstoque, 'diasRestantesValidade' | 'vencido'>): TipoAlerta {
  const dias = diasDeValidade(item);
  if (item.vencido === true || (dias !== null && dias <= 0)) return 'vencido';
  if (dias !== null) return 'vencendo';
  return 'estoque';
}

const PRIORIDADE: Record<TipoAlerta, number> = { vencido: 0, vencendo: 1, estoque: 2 };

/**
 * Vencidos primeiro, depois os que vencem logo, depois estoque baixo, mantendo a ordem do backend
 * dentro de cada grupo. Sem isso, cortar a lista (Início mostra 3) podia esconder um vencido: o backend
 * ordena por status e percentual de estoque, e um vencido com estoque folgado vem por último.
 */
export function ordenarAlertas<T extends AlertaEstoque>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => PRIORIDADE[tipoAlerta(a)] - PRIORIDADE[tipoAlerta(b)]);
}

/** "Vencido", "Vence hoje", "Vence amanhã" ou "Vence em N dias", coerente com tipoAlerta. */
export function textoAlertaValidade(item: Pick<AlertaEstoque, 'diasRestantesValidade' | 'vencido'>): string {
  return textoValidade(diasDeValidade(item) ?? 0, tipoAlerta(item) === 'vencido');
}

/** Lista do backend ou vazia, se a resposta vier sem o campo ou com outro tipo. */
export function listaOuVazia<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}
