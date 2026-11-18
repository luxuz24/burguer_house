import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';
import { prisma } from '../../../infra/database/prisma.js';
import { normalizarDataHoraLojaParaIso } from '../../../shared/datas.js';

const dataEmissaoComFusoOuDataSchema = z.union([
  z.iso.datetime({ offset: true }),
  z.iso.date(),
]);

function normalizarDataEmissaoXml(bruta: string): string | undefined {
  if (!bruta) return undefined;
  const direta = dataEmissaoComFusoOuDataSchema.safeParse(bruta);
  if (direta.success) {
    return direta.data;
  }
  const local = z.iso.datetime({ local: true }).safeParse(bruta);
  if (!local.success) {
    return undefined;
  }
  return normalizarDataHoraLojaParaIso(local.data) ?? undefined;
}

export interface SugestaoAlternativa {
  insumoId: string;
  insumoNome: string;
  unidade: string;
  confianca: number;
}

export interface ItemNFeExtraido {
  itemNumero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  valorTotal: number;
  sugestaoInsumoId: string | null;
  sugestaoInsumoNome: string | null;
  sugestaoUnidadeInsumo: string | null;
  fatorConversaoSugerido: number;
  quantidadeConvertidaSugerida: number;
  conversaoIncerta?: boolean | undefined;
  erro?: string | undefined;
  confiancaMatch?: number | undefined;
  motivoMatch?: 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM' | undefined;
  outrasSugestoes?: SugestaoAlternativa[] | undefined;
}

export interface NFeParseada {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao?: string | undefined;
  fornecedor: {
    nome: string;
    cnpjCpf: string;
  };
  valorTotal: number;
  erroValorTotal?: string | undefined;
  totalItensComErro?: number | undefined;
  itens: ItemNFeExtraido[];
}

export interface InsumoBasico {
  id: string;
  nome: string;
  unidade: string;
}

export interface MatchResult {
  insumoId: string | null;
  insumoNome: string | null;
  unidade: string | null;
  confianca: number;
  motivo: 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM';
  outrasSugestoes: SugestaoAlternativa[];
}

const ALIASES: Record<string, string[]> = {
  brioche: ['pao', 'brioche'],
  cheddar: ['queijo', 'cheddar'],
  mussarela: ['queijo', 'mussarela'],
  mucarela: ['queijo', 'mussarela'],
  mozarela: ['queijo', 'mussarela'],
  mozzarella: ['queijo', 'mussarela'],
  bacon: ['bacon'],
  coca: ['coca', 'cola'],
  coke: ['coca', 'cola'],
  refrig: ['coca', 'cola'],
  batata: ['batata'],
  frango: ['frango'],
  cebola: ['cebola'],
  alho: ['alho'],
  mostarda: ['mostarda'],
  maionese: ['maionese'],
  oleo: ['oleo', 'soja'],
  soja: ['oleo', 'soja'],
  panko: ['panko'],
  barbecue: ['barbecue'],
  geleia: ['geleia', 'pimenta'],
  pimenta: ['pimenta'],
  tomate: ['tomate'],
  alface: ['alface'],
  rucula: ['rucula'],
  hamburguer: ['carne', 'hamburguer'],
  burger: ['carne', 'hamburguer'],
  hamb: ['carne', 'hamburguer'],
  shoyu: ['shoyu'],
  acucar: ['acucar'],
  sal: ['sal'],
  leite: ['leite'],
  ovo: ['ovo'],
};

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'com', 'para', 'em', 'tipo', 'extra',
  'cx', 'pct', 'un', 'und', 'kg', 'g', 'gr', 'ml', 'l', 'lt', 'refinado',
  'congelado', 'defumado', 'especial', 'premium', 'friboi', 'sadia', 'perdigao',
  'seara', 'pet', 'barra', 'fatia', 'fatiado', 'nacional', 'sc', 'fdo'
]);

// ESPELHO CANÔNICO: Manter rigorosamente sincronizado com frontend/src/lib/unidades.ts
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

  // 1. Ambas são conhecidas e equivalentes no padrão canônico (ex: KG=KG, UN=UN, QUILOS=KG)
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

  // 3. Fallback: unidade desconhecida (ex: CX, PCT, FD) ou incompatível (ex: UN para G)
  // Mantém 1:1 mas SINALIZA conversaoIncerta: true para o operador revisar no modal
  return { fator: 1, quantidadeConvertida: quantidade, conversaoIncerta: true };
}

// 2 = unidade da nota compatível com a do insumo (mesma grandeza), 1 = não dá para saber (unidade
// desconhecida, ex.: CX, PCT), 0 = incompatível (ex.: nota em UN, insumo em Gramas).
type CompatibilidadeUnidade = 0 | 1 | 2;

function compatibilidadeUnidade(unidadeNota: string | undefined, unidadeInsumo: string): CompatibilidadeUnidade {
  if (!unidadeNota || !normalizarUnidade(unidadeNota) || !normalizarUnidade(unidadeInsumo)) return 1;
  return sugerirConversao(unidadeNota, unidadeInsumo).conversaoIncerta ? 0 : 2;
}

export interface ResultadoParseNumero {
  valor: number;
  valido: boolean;
  motivoInvalido?: string | undefined;
}

export function parsearNumeroXml(val: unknown): ResultadoParseNumero {
  if (val === null || val === undefined || val === '') {
    return { valor: 0, valido: false, motivoInvalido: 'Valor numérico ausente ou vazio no XML' };
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || val < 0) {
      return { valor: 0, valido: false, motivoInvalido: 'Valor numérico não finito ou negativo' };
    }
    return { valor: val, valido: true };
  }
  const limpo = String(val).trim();
  if (!limpo) {
    return { valor: 0, valido: false, motivoInvalido: 'Valor numérico vazio no XML' };
  }
  // No XML de NF-e o padrão TDec usa ponto. Se vier vírgula simples sem pontos, suporta como fallback legado.
  // Se contiver ponto e vírgula juntos (ex.: "1.234,56"), falha explicitamente para não mascarar parsing truncado.
  if (limpo.includes('.') && limpo.includes(',')) {
    return { valor: 0, valido: false, motivoInvalido: `Formato numérico incompatível com XML: "${limpo}"` };
  }
  const normalizado = limpo.includes(',') ? limpo.replace(',', '.') : limpo;
  const num = Number(normalizado);
  if (!Number.isFinite(num) || isNaN(num) || num < 0) {
    return { valor: 0, valido: false, motivoInvalido: `Valor numérico inválido: "${limpo}"` };
  }
  return { valor: num, valido: true };
}

export class XmlParserService {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
      parseTagValue: false,
    });
  }

  public normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  public extrairTokens(texto: string): string[] {
    const normalizado = this.normalizarTexto(texto);
    return normalizado
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  }

  public async carregarHistoricoMapeamentos(descricoes: string[]): Promise<Map<string, InsumoBasico>> {
    const mapa = new Map<string, InsumoBasico>();
    const unicas = [...new Set(descricoes.map((d) => d.trim()).filter(Boolean))];
    if (unicas.length === 0) return mapa;

    try {
      const registros = await prisma.itemNotaFiscal.findMany({
        where: {
          insumoId: { not: null },
          OR: unicas.map((desc) => ({
            descricaoOriginal: { equals: desc, mode: 'insensitive' as const },
          })),
        },
        include: {
          insumo: {
            select: { id: true, nome: true, unidade: true },
          },
        },
        orderBy: { criadoEm: 'desc' },
      });

      for (const reg of registros) {
        if (!reg.insumo) continue;
        const chave = reg.descricaoOriginal.trim().toLowerCase();
        if (!mapa.has(chave)) {
          mapa.set(chave, reg.insumo);
        }
      }
    } catch {
      // Caso ocorra falha de consulta ao histórico, segue com mapa vazio
    }

    return mapa;
  }

  /**
   * @param unidadeNota unidade do item na nota (uCom). Opcional; quando vem, desempata candidatos e impede
   * que um vínculo anterior com unidade incompatível (ex.: nota em UN ligada a insumo em Gramas) se repita.
   */
  public async encontrarMelhorMatch(
    descricao: string,
    insumos: InsumoBasico[],
    historicoPreCarregado?: Map<string, InsumoBasico>,
    unidadeNota?: string,
  ): Promise<MatchResult> {
    const descTrim = descricao.trim();

    // 1. Histórico de mapeamentos anteriores (se já foi vinculado antes, 100% de confiança).
    // Com unidade incompatível com a da nota, só vale se os tokens não acharem um candidato compatível
    // (passo 3): assim um vínculo errado confirmado uma vez não se repete em toda nota seguinte.
    let historicoIncompativel: InsumoBasico | null = null;
    if (historicoPreCarregado) {
      const insumoHistorico = historicoPreCarregado.get(descTrim.toLowerCase());
      if (insumoHistorico && compatibilidadeUnidade(unidadeNota, insumoHistorico.unidade) === 0) {
        historicoIncompativel = insumoHistorico;
      } else if (insumoHistorico) {
        return {
          insumoId: insumoHistorico.id,
          insumoNome: insumoHistorico.nome,
          unidade: insumoHistorico.unidade,
          confianca: 100,
          motivo: 'HISTORICO',
          outrasSugestoes: [],
        };
      }
    } else {
      try {
        const historico = await prisma.itemNotaFiscal.findFirst({
          where: {
            descricaoOriginal: {
              equals: descTrim,
              mode: 'insensitive',
            },
            insumoId: { not: null },
          },
          include: {
            insumo: {
              select: { id: true, nome: true, unidade: true },
            },
          },
          orderBy: { criadoEm: 'desc' },
        });

        if (historico?.insumo && compatibilidadeUnidade(unidadeNota, historico.insumo.unidade) === 0) {
          historicoIncompativel = historico.insumo;
        } else if (historico?.insumo) {
          return {
            insumoId: historico.insumo.id,
            insumoNome: historico.insumo.nome,
            unidade: historico.insumo.unidade,
            confianca: 100,
            motivo: 'HISTORICO',
            outrasSugestoes: [],
          };
        }
      } catch {
        // Caso ocorra falha de consulta ao histórico, continua com algoritmo de tokens
      }
    }

    // 2. Match Exato
    const descNorm = this.normalizarTexto(descricao);
    const exato = insumos.find((i) => this.normalizarTexto(i.nome) === descNorm);
    if (exato) {
      return {
        insumoId: exato.id,
        insumoNome: exato.nome,
        unidade: exato.unidade,
        confianca: 99,
        motivo: 'EXATO',
        outrasSugestoes: [],
      };
    }

    // 3. Match por Tokens, Similaridade e Sinônimos
    const tokensDesc = this.extrairTokens(descricao);
    const tokensExpandidos = new Set<string>(tokensDesc);
    for (const t of tokensDesc) {
      if (ALIASES[t]) {
        ALIASES[t]!.forEach((a) => tokensExpandidos.add(a));
      }
    }

    const candidatos: Array<{
      insumo: InsumoBasico;
      score: number; // pontuação bruta, sem o teto de 95 (o teto vale só para a confiança exibida)
      compat: CompatibilidadeUnidade;
      motivo: 'SINONIMO' | 'SIMILARIDADE';
    }> = [];

    for (const insumo of insumos) {
      const tokensIns = this.extrairTokens(insumo.nome);
      if (tokensIns.length === 0) continue;

      let matches = 0;
      let aliasMatches = 0;

      for (const tIns of tokensIns) {
        if (tokensDesc.includes(tIns)) {
          matches++;
        } else if (tokensExpandidos.has(tIns)) {
          aliasMatches++;
        } else {
          const temSub = tokensDesc.some((td) => td.includes(tIns) || tIns.includes(td));
          if (temSub) {
            matches += 0.8;
          }
        }
      }

      const totalAcertos = matches + (aliasMatches * 0.9);
      if (totalAcertos > 0) {
        let score = Math.round((totalAcertos / tokensIns.length) * 100);
        if (matches >= tokensIns.length) {
          score += 15;
        }

        candidatos.push({
          insumo,
          score,
          compat: compatibilidadeUnidade(unidadeNota, insumo.unidade),
          motivo: aliasMatches > 0 && matches === 0 ? 'SINONIMO' : 'SIMILARIDADE',
        });
      }
    }

    // Antes o teto de 95 era aplicado antes de ordenar: "Pão Brioche" (nome inteiro, 115) empatava com
    // "Carne de Hambúrguer" (hambúrguer + sinônimo, 95) e a ordem das linhas no banco decidia. Agora ordena
    // pela pontuação bruta (nome inteiro sempre passa de 100) e desempata pela unidade compatível com a da nota.
    candidatos.sort((a, b) => b.score - a.score || b.compat - a.compat);
    const confiancaExibida = (score: number) => Math.min(score, 95);
    const comoSugestao = (insumo: InsumoBasico, confianca: number) => ({
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      unidade: insumo.unidade,
      confianca,
    });

    if (historicoIncompativel) {
      const historico = historicoIncompativel;
      const compativel = candidatos.find((c) => c.compat === 2 && c.score >= 35);
      if (!compativel) {
        return {
          insumoId: historico.id,
          insumoNome: historico.nome,
          unidade: historico.unidade,
          confianca: 100,
          motivo: 'HISTORICO',
          outrasSugestoes: candidatos
            .filter((c) => c.insumo.id !== historico.id)
            .slice(0, 3)
            .map((c) => comoSugestao(c.insumo, confiancaExibida(c.score))),
        };
      }
      const doHistorico = candidatos.find((c) => c.insumo.id === historico.id);
      return {
        insumoId: compativel.insumo.id,
        insumoNome: compativel.insumo.nome,
        unidade: compativel.insumo.unidade,
        confianca: confiancaExibida(compativel.score),
        motivo: compativel.motivo,
        outrasSugestoes: [
          comoSugestao(historico, doHistorico ? confiancaExibida(doHistorico.score) : 0),
          ...candidatos
            .filter((c) => c !== compativel && c.insumo.id !== historico.id)
            .slice(0, 2)
            .map((c) => comoSugestao(c.insumo, confiancaExibida(c.score))),
        ],
      };
    }

    if (candidatos.length > 0 && candidatos[0]!.score >= 35) {
      const melhor = candidatos[0]!;
      const outras = candidatos.slice(1, 4).map((c) => comoSugestao(c.insumo, confiancaExibida(c.score)));

      return {
        insumoId: melhor.insumo.id,
        insumoNome: melhor.insumo.nome,
        unidade: melhor.insumo.unidade,
        confianca: confiancaExibida(melhor.score),
        motivo: melhor.motivo,
        outrasSugestoes: outras,
      };
    }

    return {
      insumoId: null,
      insumoNome: null,
      unidade: null,
      confianca: 0,
      motivo: 'NENHUM',
      outrasSugestoes: [],
    };
  }

  public sugerirConversao(
    unidadeNota: string,
    unidadeInsumo: string,
    quantidade: number
  ): { fator: number; quantidadeConvertida: number; conversaoIncerta: boolean } {
    return sugerirConversao(unidadeNota, unidadeInsumo, quantidade);
  }

  async parse(xmlContent: string): Promise<NFeParseada> {
    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new Error('Conteúdo XML vazio ou inválido');
    }

    if (xmlContent.length > 512_000) {
      throw new Error('Conteúdo XML excede o tamanho máximo permitido (500 KB)');
    }

    let parsed: any;
    try {
      parsed = this.parser.parse(xmlContent);
    } catch {
      throw new Error('Falha ao processar estrutura XML da nota fiscal');
    }

    // Suporte tanto a <nfeProc><NFe> quanto <NFe> direto
    const nfe = parsed?.nfeProc?.NFe || parsed?.NFe;
    if (!nfe) {
      throw new Error('XML não contém a tag raiz <NFe> válida');
    }

    const infNFe = nfe?.infNFe;
    if (!infNFe) {
      throw new Error('XML de NF-e inválido: tag <infNFe> não encontrada');
    }

    // 1. Extração de Chave de Acesso
    let chave = parsed?.nfeProc?.protNFe?.infProt?.chNFe;
    if (!chave) {
      const idAttr = infNFe['@_Id'] || '';
      chave = idAttr.replace(/^NFe/, '');
    }

    // 2. Dados do Emitente (Fornecedor)
    const emit = infNFe?.emit || {};
    const fornecedorNome = emit.xNome || emit.xFant || 'Fornecedor não identificado';
    const fornecedorCnpj = String(emit.CNPJ || emit.CPF || '');

    // 3. Dados de Identificação da Nota
    const ide = infNFe?.ide || {};
    const numero = String(ide.nNF || '');
    const serie = String(ide.serie || '');
    const dataEmissaoBruta = typeof (ide.dhEmi || ide.dEmi) === 'string' ? (ide.dhEmi || ide.dEmi).trim() : '';
    const dataEmissao = normalizarDataEmissaoXml(dataEmissaoBruta);

    // 4. Totais
    const total = infNFe?.total?.ICMSTot || {};
    const totalParse = parsearNumeroXml(total.vNF || total.vProd);
    const valorTotal = totalParse.valor;
    const erroValorTotal = !totalParse.valido ? totalParse.motivoInvalido : undefined;

    // 5. Itens da Nota
    const detRaw = infNFe?.det;
    const detList: any[] = Array.isArray(detRaw) ? detRaw : (detRaw ? [detRaw] : []);

    const descricoesNota = detList.map((item) => String(item?.prod?.xProd || ''));

    // Busca insumos e histórico em lote (evita N+1 queries por item da nota)
    const [insumosDisponiveis, historicoMapeamentos] = await Promise.all([
      prisma.insumo.findMany({
        select: { id: true, nome: true, unidade: true },
      }),
      this.carregarHistoricoMapeamentos(descricoesNota),
    ]);

    const itens: ItemNFeExtraido[] = [];
    let totalItensComErro = 0;

    for (let index = 0; index < detList.length; index++) {
      const item = detList[index];
      const prod = item.prod || {};
      const itemNumero = Number(item['@_nItem'] || index + 1);
      const codigo = String(prod.cProd || '');
      const descricao = String(prod.xProd || '');
      const ncm = String(prod.NCM || '');
      const unidadeOriginal = String(prod.uCom || '').trim();

      const qComParse = parsearNumeroXml(prod.qCom);
      const vUnComParse = parsearNumeroXml(prod.vUnCom);
      const vProdParse = parsearNumeroXml(prod.vProd);

      const errosItem: string[] = [];
      if (!qComParse.valido || qComParse.valor <= 0) {
        errosItem.push(qComParse.motivoInvalido || 'Quantidade inválida ou menor/igual a zero');
      }
      if (!vUnComParse.valido) {
        errosItem.push(vUnComParse.motivoInvalido || 'Valor unitário inválido');
      }
      if (prod.vProd !== undefined && prod.vProd !== '' && !vProdParse.valido) {
        errosItem.push(vProdParse.motivoInvalido || 'Valor total do item no XML é inválido');
      }

      const quantidadeOriginal = qComParse.valor;
      const valorUnitario = vUnComParse.valor;
      const valorTotalItem = vProdParse.valido && vProdParse.valor > 0
        ? vProdParse.valor
        : quantidadeOriginal * valorUnitario;

      const erro = errosItem.length > 0 ? errosItem.join('; ') : undefined;
      if (erro) {
        totalItensComErro++;
      }

      // Busca inteligente com score, sinônimos e histórico pré-carregado
      const match = await this.encontrarMelhorMatch(descricao, insumosDisponiveis, historicoMapeamentos, unidadeOriginal);

      const conversao = match.unidade
        ? this.sugerirConversao(unidadeOriginal, match.unidade, quantidadeOriginal)
        : { fator: 1, quantidadeConvertida: quantidadeOriginal, conversaoIncerta: true };

      itens.push({
        itemNumero,
        codigo,
        descricao,
        ncm,
        unidadeOriginal,
        quantidadeOriginal,
        valorUnitario,
        valorTotal: valorTotalItem,
        sugestaoInsumoId: match.insumoId,
        sugestaoInsumoNome: match.insumoNome,
        sugestaoUnidadeInsumo: match.unidade,
        fatorConversaoSugerido: conversao.fator,
        quantidadeConvertidaSugerida: conversao.quantidadeConvertida,
        conversaoIncerta: conversao.conversaoIncerta,
        erro,
        confiancaMatch: match.confianca,
        motivoMatch: match.motivo,
        outrasSugestoes: match.outrasSugestoes,
      });
    }

    return {
      chaveAcesso: String(chave || ''),
      numero,
      serie,
      ...(dataEmissao ? { dataEmissao } : {}),
      fornecedor: {
        nome: fornecedorNome,
        cnpjCpf: fornecedorCnpj,
      },
      valorTotal,
      ...(erroValorTotal ? { erroValorTotal } : {}),
      ...(totalItensComErro > 0 ? { totalItensComErro } : {}),
      itens,
    };
  }
}
