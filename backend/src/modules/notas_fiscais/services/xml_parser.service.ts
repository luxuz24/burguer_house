import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../../../infra/database/prisma.js';

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
  confiancaMatch?: number | undefined;
  motivoMatch?: 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM' | undefined;
  outrasSugestoes?: SugestaoAlternativa[] | undefined;
}

export interface NFeParseada {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedor: {
    nome: string;
    cnpjCpf: string;
  };
  valorTotal: number;
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

  public async encontrarMelhorMatch(
    descricao: string,
    insumos: InsumoBasico[],
    historicoPreCarregado?: Map<string, InsumoBasico>
  ): Promise<MatchResult> {
    const descTrim = descricao.trim();

    // 1. Histórico de mapeamentos anteriores (se já foi vinculado antes, 100% de confiança)
    if (historicoPreCarregado) {
      const insumoHistorico = historicoPreCarregado.get(descTrim.toLowerCase());
      if (insumoHistorico) {
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

        if (historico?.insumo) {
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
      score: number;
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
          score = Math.min(100, score + 15);
        }
        score = Math.min(score, 95);

        candidatos.push({
          insumo,
          score,
          motivo: aliasMatches > 0 && matches === 0 ? 'SINONIMO' : 'SIMILARIDADE',
        });
      }
    }

    candidatos.sort((a, b) => b.score - a.score);

    if (candidatos.length > 0 && candidatos[0]!.score >= 35) {
      const melhor = candidatos[0]!;
      const outras = candidatos.slice(1, 4).map((c) => ({
        insumoId: c.insumo.id,
        insumoNome: c.insumo.nome,
        unidade: c.insumo.unidade,
        confianca: c.score,
      }));

      return {
        insumoId: melhor.insumo.id,
        insumoNome: melhor.insumo.nome,
        unidade: melhor.insumo.unidade,
        confianca: melhor.score,
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

  public sugerirConversao(unidadeNota: string, unidadeInsumo: string, quantidade: number): { fator: number; quantidadeConvertida: number } {
    const uNota = unidadeNota.toUpperCase().trim();
    const uIns = unidadeInsumo.toUpperCase().trim();

    // Se as unidades forem equivalentes
    if (uNota === uIns || (uNota === 'UN' && uIns === 'UNIDADE') || (uNota === 'G' && uIns === 'GRAMAS') || (uNota === 'ML' && uIns === 'MILILITROS')) {
      return { fator: 1, quantidadeConvertida: quantidade };
    }

    // De Quilos para Gramas
    if ((uNota === 'KG' || uNota === 'KILO' || uNota === 'QUILO') && uIns === 'GRAMAS') {
      return { fator: 1000, quantidadeConvertida: quantidade * 1000 };
    }

    // De Gramas para Quilos
    if ((uNota === 'G' || uNota === 'GR') && uIns === 'KILOGRAMAS') {
      return { fator: 0.001, quantidadeConvertida: quantidade * 0.001 };
    }

    // De Litros para Mililitros
    if ((uNota === 'L' || uNota === 'LT' || uNota === 'LITRO') && uIns === 'MILILITROS') {
      return { fator: 1000, quantidadeConvertida: quantidade * 1000 };
    }

    // De Mililitros para Litros
    if ((uNota === 'ML') && (uIns === 'L' || uIns === 'LITROS')) {
      return { fator: 0.001, quantidadeConvertida: quantidade * 0.001 };
    }

    // Padrão: 1 para 1
    return { fator: 1, quantidadeConvertida: quantidade };
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
    const dataEmissao = ide.dhEmi || ide.dEmi || new Date().toISOString();

    // 4. Totais
    const total = infNFe?.total?.ICMSTot || {};
    const valorTotal = Number(total.vNF || total.vProd || 0);

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

    for (let index = 0; index < detList.length; index++) {
      const item = detList[index];
      const prod = item.prod || {};
      const itemNumero = Number(item['@_nItem'] || index + 1);
      const codigo = String(prod.cProd || '');
      const descricao = String(prod.xProd || '');
      const ncm = String(prod.NCM || '');
      const unidadeOriginal = String(prod.uCom || '').trim();
      const quantidadeOriginal = Number(prod.qCom || 0);
      const valorUnitario = Number(prod.vUnCom || 0);
      const valorTotalItem = Number(prod.vProd || (quantidadeOriginal * valorUnitario));

      // Busca inteligente com score, sinônimos e histórico pré-carregado
      const match = await this.encontrarMelhorMatch(descricao, insumosDisponiveis, historicoMapeamentos);

      const { fator, quantidadeConvertida } = match.unidade
        ? this.sugerirConversao(unidadeOriginal, match.unidade, quantidadeOriginal)
        : { fator: 1, quantidadeConvertida: quantidadeOriginal };

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
        fatorConversaoSugerido: fator,
        quantidadeConvertidaSugerida: quantidadeConvertida,
        confiancaMatch: match.confianca,
        motivoMatch: match.motivo,
        outrasSugestoes: match.outrasSugestoes,
      });
    }

    return {
      chaveAcesso: String(chave || ''),
      numero,
      serie,
      dataEmissao,
      fornecedor: {
        nome: fornecedorNome,
        cnpjCpf: fornecedorCnpj,
      },
      valorTotal,
      itens,
    };
  }
}
