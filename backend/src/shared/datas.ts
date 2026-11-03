export const TIMEZONE_LOJA = 'America/Campo_Grande';

/**
 * Calcula o offset de minutos da timezone em relação a UTC para uma determinada data.
 * Baseado puramente na API nativa Intl.DateTimeFormat (IANA timezones), sem hardcode.
 */
function obterOffsetMinutos(data: Date, timeZone: string): number {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const partes = formatador.formatToParts(data);
  const tzName = partes.find((p) => p.type === 'timeZoneName')?.value;
  const match = tzName?.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sinal = match[1] === '+' ? 1 : -1;
  const horas = parseInt(match[2]!, 10);
  const minutos = match[3] ? parseInt(match[3], 10) : 0;
  return sinal * (horas * 60 + minutos);
}

/**
 * Cria um objeto Date em UTC a partir de componentes de data e hora locais no fuso da loja (America/Campo_Grande).
 * Garante que a hora civil em Campo Grande seja exatamente convertida para UTC considerando o offset vigente.
 */
export function criarDataLoja(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0,
  ms = 0,
): Date {
  const aproximado = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, ms));
  const offsetMinutos = obterOffsetMinutos(aproximado, TIMEZONE_LOJA);
  return new Date(aproximado.getTime() - offsetMinutos * 60_000);
}

/**
 * Extrai os componentes de data civil vigentes no fuso da loja (America/Campo_Grande).
 */
export function obterPartesDataLoja(data: Date = new Date()): {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
} {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_LOJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partes = formatador.formatToParts(data);
  const ano = Number(partes.find((p) => p.type === 'year')?.value);
  const mes = Number(partes.find((p) => p.type === 'month')?.value);
  const dia = Number(partes.find((p) => p.type === 'day')?.value);
  const hora = Number(partes.find((p) => p.type === 'hour')?.value);
  const minuto = Number(partes.find((p) => p.type === 'minute')?.value);
  const segundo = Number(partes.find((p) => p.type === 'second')?.value);
  return { ano, mes, dia, hora, minuto, segundo };
}

/**
 * Retorna o ano e mês atuais vigentes no fuso horário da loja (America/Campo_Grande).
 */
export function obterAnoEMesLoja(data: Date = new Date()): { ano: number; mes: number } {
  const { ano, mes } = obterPartesDataLoja(data);
  return { ano, mes };
}

/**
 * Retorna o intervalo [inicio, fim] em UTC correspondente ao dia civil no fuso da loja (America/Campo_Grande).
 * início: 00:00:00.000 em MS
 * fim:    23:59:59.999 em MS
 */
export function obterIntervaloDiaLoja(data: Date = new Date()): {
  inicio: Date;
  fim: Date;
  ano: number;
  mes: number;
  dia: number;
} {
  const { ano, mes, dia } = obterPartesDataLoja(data);
  const inicio = criarDataLoja(ano, mes, dia, 0, 0, 0, 0);
  const fim = criarDataLoja(ano, mes, dia, 23, 59, 59, 999);
  return { inicio, fim, ano, mes, dia };
}

/**
 * Retorna o intervalo [inicio, fim] de 7 dias encerrando no fim do dia no fuso da loja (America/Campo_Grande).
 */
export function obterIntervaloSemanaLoja(data: Date = new Date()): { inicio: Date; fim: Date } {
  const { inicio: inicioHoje, fim } = obterIntervaloDiaLoja(data);
  // Últimos 7 dias civis contando hoje (hoje - 6 dias até 23:59:59 de hoje)
  const inicio = new Date(inicioHoje.getTime() - 6 * 86_400_000);
  return { inicio, fim };
}

/**
 * Retorna o intervalo [inicio, fim) em UTC correspondente ao mês civil no fuso da loja (America/Campo_Grande).
 * início: 00:00:00 do dia 1 do mês em MS
 * fim:    00:00:00 do dia 1 do mês seguinte em MS
 */
export function obterIntervaloMesLoja(ano: number, mes: number): { inicio: Date; fim: Date } {
  const inicio = criarDataLoja(ano, mes, 1, 0, 0, 0, 0);
  const fim = mes === 12 ? criarDataLoja(ano + 1, 1, 1, 0, 0, 0, 0) : criarDataLoja(ano, mes + 1, 1, 0, 0, 0, 0);
  return { inicio, fim };
}

/**
 * Converte uma string YYYY-MM-DD para Date no fuso da loja (America/Campo_Grande),
 * validando que a data existe de fato no calendário civil (evitando transbordos como 2026-02-31).
 * Retorna null se a string não for uma data válida do calendário.
 *
 * @param texto string no formato YYYY-MM-DD
 * @param limite 'inicio' (00:00:00.000) | 'fim' (23:59:59.999)
 */
export function parsearDiaLoja(
  texto: string,
  limite: 'inicio' | 'fim' = 'inicio',
): Date | null {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto.trim())) {
    return null;
  }

  const [ano, mes, dia] = texto.trim().split('-').map(Number);
  if (!ano || !mes || !dia || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }

  const hora = limite === 'inicio' ? 0 : 23;
  const minuto = limite === 'inicio' ? 0 : 59;
  const segundo = limite === 'inicio' ? 0 : 59;
  const ms = limite === 'inicio' ? 0 : 999;

  const data = criarDataLoja(ano, mes, dia, hora, minuto, segundo, ms);
  const partes = obterPartesDataLoja(data);

  // Validação de ida e volta: se o dia, mês ou ano diferirem (ex.: 2026-02-31 transbordando para março), rejeita
  if (partes.ano !== ano || partes.mes !== mes || partes.dia !== dia) {
    return null;
  }

  return data;
}
