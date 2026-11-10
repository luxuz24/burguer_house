/**
 * Utilitários de formatação pt-BR padronizados para moeda, quantidades e percentuais.
 * Soluciona o achado A4 (ausência de Intl e formatações fora do padrão brasileiro).
 */

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatadorNumeroPadrao = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Formata um valor numérico como moeda brasileira (ex.: 1234.5 -> "R$ 1.234,50").
 * Aceita apenas valores numéricos finitos. Valores nulos, indefinidos, NaN ou não-finitos retornam "—".
 */
export function formatarMoeda(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return '—';
  }
  return formatadorMoeda.format(valor);
}

/**
 * Formata uma quantidade com separador de milhar brasileiro e unidade opcional.
 * Ex.: (1500, 'g') -> "1.500 g", (2.5, 'kg') -> "2,5 kg", (10) -> "10".
 * Valores inválidos ou não-finitos retornam "—".
 */
export function formatarQuantidade(
  valor: number | null | undefined,
  unidade?: string,
  casasDecimais?: number,
): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return '—';
  }

  let texto: string;
  if (typeof casasDecimais === 'number') {
    texto = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casasDecimais,
      maximumFractionDigits: casasDecimais,
    }).format(valor);
  } else {
    texto = formatadorNumeroPadrao.format(valor);
  }

  if (unidade && typeof unidade === 'string' && unidade.trim()) {
    return `${texto} ${unidade.trim()}`;
  }

  return texto;
}

/**
 * Formata um valor como percentual pt-BR.
 * Ex.: 0.155 (base 1) -> "15,5%", 15.5 (base 100) com baseCem=true -> "15,5%".
 * Valores inválidos ou não-finitos retornam "—".
 */
export function formatarPercentual(
  valor: number | null | undefined,
  baseCem = false,
): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return '—';
  }
  const percentual = baseCem ? valor : valor * 100;

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(percentual)}%`;
}

/**
 * Calcula o desconto real de insumo considerando o fator de perda (A5).
 * Espelha a regra determinística de backend/src/modules/vendas/services/planejar_consolidacao.ts:197
 * e o arredondamento seguro de 4 casas de backend/src/modules/vendas/services/consolidacao.service.ts:96.
 *
 * Fatores negativos ou nulos são normalizados para 0.
 */
export function descontoComPerda(
  quantidade: number | null | undefined,
  fatorPerda: number | null | undefined,
): number {
  const qtd = typeof quantidade === 'number' && Number.isFinite(quantidade) ? Math.max(0, quantidade) : 0;
  const fator = typeof fatorPerda === 'number' && Number.isFinite(fatorPerda) ? Math.max(0, fatorPerda) : 0;
  return Number((qtd * (1 + fator)).toFixed(4));
}

