// ESPELHO CANÔNICO: Manter rigorosamente sincronizado com backend/src/modules/notas_fiscais/services/xml_parser.service.ts
// Verificado e assegurado pelo teste de regressão: unidades_paridade.spec.ts
export type UnidadeCanonica = 'KG' | 'G' | 'L' | 'ML' | 'UN';

export const APELIDOS_UNIDADE: Record<string, UnidadeCanonica> = {
  // Massa
  KG: 'KG',
  KGS: 'KG',
  KILO: 'KG',
  KILOS: 'KG',
  QUILO: 'KG',
  QUILOS: 'KG',
  KILOGRAMA: 'KG',
  KILOGRAMAS: 'KG',

  G: 'G',
  GR: 'G',
  GRS: 'G',
  GRAMA: 'G',
  GRAMAS: 'G',

  // Volume
  L: 'L',
  LT: 'L',
  LTS: 'L',
  LITRO: 'L',
  LITROS: 'L',

  ML: 'ML',
  MLS: 'ML',
  MILILITRO: 'ML',
  MILILITROS: 'ML',

  // Unidades discretas
  UN: 'UN',
  UND: 'UN',
  UNDS: 'UN',
  UNID: 'UN',
  UNIDADE: 'UN',
  UNIDADES: 'UN',
  PC: 'UN',
  PCA: 'UN',
  PECA: 'UN',
  PECAS: 'UN',
};

export const FATORES_CONVERSAO: Partial<Record<`${UnidadeCanonica}->${UnidadeCanonica}`, number>> = {
  'KG->G': 1000,
  'G->KG': 0.001,
  'L->ML': 1000,
  'ML->L': 0.001,
};

export function normalizarUnidade(u: string): UnidadeCanonica | null {
  if (!u || typeof u !== 'string') return null;
  const limpa = u.toUpperCase().trim();
  return APELIDOS_UNIDADE[limpa] ?? null;
}

export function sugerirConversao(
  unidadeNota: string,
  unidadeInsumo: string,
  quantidade = 1,
): { fator: number; quantidadeConvertida: number; conversaoIncerta: boolean } {
  const cNota = normalizarUnidade(unidadeNota);
  const cIns = normalizarUnidade(unidadeInsumo);

  // 1. Ambas são conhecidas e equivalentes no padrão canônico (ex.: KG=KG, UN=UN, QUILOS=KG)
  if (cNota && cIns && cNota === cIns) {
    return { fator: 1, quantidadeConvertida: quantidade, conversaoIncerta: false };
  }

  // 2. Conversão direta entre grandezas compatíveis (massa: KG <-> G, volume: L <-> ML)
  if (cNota && cIns) {
    const chave = `${cNota}->${cIns}` as const;
    const fator = FATORES_CONVERSAO[chave];
    if (fator !== undefined) {
      return { fator, quantidadeConvertida: quantidade * fator, conversaoIncerta: false };
    }
  }

  // 3. Fallback: unidade desconhecida (ex.: CX, PCT, FD) ou incompatível (ex.: UN para Gramas)
  // Mantém 1:1 mas SINALIZA conversaoIncerta: true para o operador revisar no modal
  return { fator: 1, quantidadeConvertida: quantidade, conversaoIncerta: true };
}
