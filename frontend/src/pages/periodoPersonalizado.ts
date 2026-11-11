/**
 * Período personalizado de Relatórios (GET /api/dashboard/resumo?dataInicio=&dataFim=).
 * O backend lê `yyyy-mm-dd` como dia inteiro no fuso da loja (início 00:00, fim 23:59:59.999) e
 * recusa intervalo com mais de 366 dias (dashboard.service.ts:105 e 159-163). Como o fim vai até
 * 23:59, o maior intervalo aceito é de 366 dias contando os dois extremos (ex.: 01/01/2026 a 01/01/2027).
 */
export const MAX_DIAS_PERIODO = 366;

const TIMEZONE_LOJA = 'America/Campo_Grande';
const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 86_400_000;

/** Milissegundos UTC do dia (00:00 UTC), ou null se não for uma data `yyyy-mm-dd` que existe. */
function diaUtc(texto: string): number | null {
  const m = FORMATO_DIA.exec(texto);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(ano, mes - 1, dia);
  const data = new Date(ms);
  // Ida e volta: 2026-02-30 vira 02/03 e é recusado, como no backend (parsearDiaLoja)
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  return ms;
}

/** Quantos dias o intervalo tem, contando início e fim (mesmo dia = 1). */
export function diasNoPeriodo(inicio: string, fim: string): number | null {
  const a = diaUtc(inicio);
  const b = diaUtc(fim);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DIA_MS) + 1;
}

/** Mensagem do problema do período, ou null se pode ser enviado ao backend. */
export function validarPeriodo(inicio: string, fim: string): string | null {
  if (!inicio || !fim) return 'Informe as duas datas.';
  if (diaUtc(inicio) === null || diaUtc(fim) === null) return 'Data inválida.';
  const dias = diasNoPeriodo(inicio, fim) as number;
  if (dias < 1) return 'A data de início não pode ser depois da data de fim.';
  if (dias > MAX_DIAS_PERIODO) return `O período pode ter no máximo ${MAX_DIAS_PERIODO} dias.`;
  return null;
}

/** Dia de hoje (`yyyy-mm-dd`) no fuso da loja. */
export function hojeNaLoja(agora: Date = new Date()): string {
  // en-CA formata como yyyy-mm-dd
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_LOJA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Primeiro dia do mês corrente (`yyyy-mm-01`) no fuso da loja. */
export function inicioDoMesNaLoja(agora: Date = new Date()): string {
  return `${hojeNaLoja(agora).slice(0, 8)}01`;
}

/** `2026-11-01` → `01/11/2026` (sem passar por Date: não há fuso para errar). */
export function diaPorExtensoCurto(texto: string): string {
  const m = FORMATO_DIA.exec(texto);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}
