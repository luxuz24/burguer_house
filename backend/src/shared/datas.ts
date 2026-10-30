export const TIMEZONE_LOJA = 'America/Campo_Grande';

/**
 * Retorna o ano e mês atuais vigentes no fuso horário da loja (America/Campo_Grande).
 * Mato Grosso do Sul opera em UTC-4 sem horário de verão.
 */
export function obterAnoEMesLoja(data: Date = new Date()): { ano: number; mes: number } {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_LOJA,
    year: 'numeric',
    month: 'numeric',
  });
  const partes = formatador.formatToParts(data);
  const ano = Number(partes.find((p) => p.type === 'year')?.value);
  const mes = Number(partes.find((p) => p.type === 'month')?.value);
  return { ano, mes };
}

/**
 * Retorna o intervalo [inicio, fim) em UTC correspondente ao mês civil no fuso da loja (America/Campo_Grande).
 * À meia-noite em MS (00:00:00 UTC-4), o relógio em UTC marca exatamente 04:00:00Z.
 * Exemplo para ano=2026, mes=10 (outubro):
 * - inicio: 2026-10-01T04:00:00.000Z
 * - fim:    2026-11-01T04:00:00.000Z
 */
export function obterIntervaloMesLoja(ano: number, mes: number): { inicio: Date; fim: Date } {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 4, 0, 0, 0));
  const fim = new Date(Date.UTC(ano, mes, 1, 4, 0, 0, 0));
  return { inicio, fim };
}
