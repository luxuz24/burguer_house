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

/**
 * Calcula o consumo estimado de insumo bruto na produção de item beneficiado,
 * com exata paridade com a fórmula de backend/src/modules/preparo_interno/services/producao.service.ts:41.
 * Arredonda para 4 casas decimais.
 * Nota: producao.service.ts não normaliza fator de perda negativo (registrado em docs/requests.md).
 */
export function consumoProducao(
  quantidadeNecessaria: number | null | undefined,
  fatorPerda: number | null | undefined,
  quantidade: number | null | undefined,
): number {
  const qtdNec = typeof quantidadeNecessaria === 'number' && Number.isFinite(quantidadeNecessaria) ? quantidadeNecessaria : 0;
  const perda = typeof fatorPerda === 'number' && Number.isFinite(fatorPerda) ? fatorPerda : 0;
  const qtd = typeof quantidade === 'number' && Number.isFinite(quantidade) ? quantidade : 0;
  return Number((qtdNec * (1 + perda) * qtd).toFixed(4));
}

/**
 * Formata um timestamp ISO como data e hora abreviada no fuso horário do Mato Grosso do Sul (America/Campo_Grande).
 * Ex.: "2026-11-01T03:30:00Z" -> "31/10, 23:30"
 * Valores inválidos ou nulos retornam "—".
 */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—';
  const data = new Date(iso);
  if (isNaN(data.getTime())) return '—';

  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Campo_Grande',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partes = formatador.formatToParts(data);
  const dia = partes.find((p) => p.type === 'day')?.value ?? '';
  const mes = partes.find((p) => p.type === 'month')?.value ?? '';
  const hora = partes.find((p) => p.type === 'hour')?.value ?? '';
  const minuto = partes.find((p) => p.type === 'minute')?.value ?? '';

  return `${dia}/${mes}, ${hora}:${minuto}`;
}


export const TIMEZONE_LOJA = 'America/Campo_Grande';

function partesTempoNaLoja(agora: Date = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_LOJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(agora);

  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const ano = get('year');
  const mes = get('month');
  const dia = get('day');
  const hora = Number(get('hour')) % 24;
  const minuto = Number(get('minute'));
  const segundo = Number(get('second'));
  const ms = agora.getMilliseconds();
  const msDecorridosHoje = ((hora * 60 + minuto) * 60 + segundo) * 1000 + ms;

  return { ano, mes, dia, hora, minuto, segundo, ms, msDecorridosHoje };
}

/** Data no fuso da loja no formato ISO "AAAA-MM-DD" (ex.: "2026-11-12"). */
export function dataHojeNaLoja(agora: Date = new Date()): string {
  const { ano, mes, dia } = partesTempoNaLoja(agora);
  return `${ano}-${mes}-${dia}`;
}

/**
 * Milissegundos restantes até a próxima meia-noite (00:00:00.000) no fuso da loja (America/Campo_Grande).
 * Usado pelo Início para agendar a virada de dia independentemente do fuso do aparelho.
 */
export function msAteProximaMeiaNoiteNaLoja(agora: Date = new Date()): number {
  const { msDecorridosHoje } = partesTempoNaLoja(agora);
  const restante = 86_400_000 - msDecorridosHoje;
  return restante <= 0 ? 86_400_000 : restante;
}

/**
 * Milissegundos restantes até a próxima virada de saudação (12h, 18h ou 24h/meia-noite) no fuso da loja.
 * Garante transição automática entre "Bom dia", "Boa tarde" e "Boa noite".
 */
export function msAteProximaFronteiraSaudacaoNaLoja(agora: Date = new Date()): number {
  const { hora, msDecorridosHoje } = partesTempoNaLoja(agora);
  const proximaHora = hora < 12 ? 12 : hora < 18 ? 18 : 24;
  const restante = proximaHora * 3_600_000 - msDecorridosHoje;
  return restante <= 0 ? 86_400_000 : restante;
}

/** Hora (0–23) atual no fuso da loja. */
export function horaNaLoja(agora: Date = new Date()): number {
  return partesTempoNaLoja(agora).hora;
}

/** Saudação pela hora da loja: "Bom dia" (até 11h), "Boa tarde" (até 17h), "Boa noite". */
export function saudacao(agora: Date = new Date()): string {
  const h = horaNaLoja(agora);
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Data por extenso no fuso da loja: "Segunda, 10 de novembro". */
export function dataPorExtenso(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE_LOJA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(agora);
  const dia = partes.find((p) => p.type === 'weekday')?.value.replace('-feira', '') ?? '';
  const numero = partes.find((p) => p.type === 'day')?.value ?? '';
  const mes = partes.find((p) => p.type === 'month')?.value ?? '';
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${numero} de ${mes}`;
}

/** Prazo de validade em texto curto: "Vencido", "Vence hoje", "Vence amanhã", "Vence em 3 dias". */
export function textoValidade(diasRestantes: number, vencido = false): string {
  if (vencido || diasRestantes < 0) return 'Vencido';
  if (diasRestantes === 0) return 'Vence hoje';
  if (diasRestantes === 1) return 'Vence amanhã';
  return `Vence em ${diasRestantes} dias`;
}

/** Texto pronto para busca: minúsculo e sem acento ("Pão" e "pao" viram "pao"). */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
