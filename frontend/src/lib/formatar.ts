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
  maximumFractionDigits: 3,
});

/**
 * Converte qualquer entrada numérica/string em número finito ou 0.
 */
function paraNumeroSeguro(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0;
  const num = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
}

/**
 * Formata um valor numérico como moeda brasileira (ex.: 1234.5 -> "R$ 1.234,50").
 */
export function formatarMoeda(valor: number | string | null | undefined): string {
  const numero = paraNumeroSeguro(valor);
  return formatadorMoeda.format(numero);
}

/**
 * Formata uma quantidade com separador de milhar brasileiro e unidade opcional.
 * Ex.: (1500, 'g') -> "1.500 g", (2.5, 'kg') -> "2,5 kg", (10) -> "10".
 */
export function formatarQuantidade(
  valor: number | string | null | undefined,
  unidade?: string,
  casasDecimais?: number,
): string {
  const numero = paraNumeroSeguro(valor);

  let texto: string;
  if (typeof casasDecimais === 'number') {
    texto = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casasDecimais,
      maximumFractionDigits: casasDecimais,
    }).format(numero);
  } else {
    texto = formatadorNumeroPadrao.format(numero);
  }

  if (unidade && typeof unidade === 'string' && unidade.trim()) {
    return `${texto} ${unidade.trim()}`;
  }

  return texto;
}

/**
 * Formata um valor como percentual pt-BR.
 * Ex.: 0.155 (base 1) -> "15,5%", 15.5 (base 100) com baseCem=true -> "15,5%".
 */
export function formatarPercentual(
  valor: number | string | null | undefined,
  baseCem = false,
): string {
  const numero = paraNumeroSeguro(valor);
  const percentual = baseCem ? numero : numero * 100;

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(percentual)}%`;
}
