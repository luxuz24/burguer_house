import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../../../infra/database/prisma.js';

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

  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private sugerirConversao(unidadeNota: string, unidadeInsumo: string, quantidade: number): { fator: number; quantidadeConvertida: number } {
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

    // Buscar todos os insumos cadastrados no almoxarifado para tentar casamento inteligente
    const insumosDisponiveis = await prisma.insumo.findMany({
      select: { id: true, nome: true, unidade: true },
    });

    const itens: ItemNFeExtraido[] = detList.map((item, index) => {
      const prod = item.prod || {};
      const itemNumero = Number(item['@_nItem'] || index + 1);
      const codigo = String(prod.cProd || '');
      const descricao = String(prod.xProd || '');
      const ncm = String(prod.NCM || '');
      const unidadeOriginal = String(prod.uCom || '').trim();
      const quantidadeOriginal = Number(prod.qCom || 0);
      const valorUnitario = Number(prod.vUnCom || 0);
      const valorTotalItem = Number(prod.vProd || (quantidadeOriginal * valorUnitario));

      // Busca insumo correspondente por similaridade de nome
      const descNorm = this.normalizarTexto(descricao);
      let insumoCasado = insumosDisponiveis.find((ins) => {
        const insNorm = this.normalizarTexto(ins.nome);
        return descNorm.includes(insNorm) || insNorm.includes(descNorm);
      });

      // Se não achou por substring completa, busca por palavras-chave principais
      if (!insumoCasado) {
        const palavrasChave = descNorm.split(/\s+/).filter((w) => w.length >= 4);
        insumoCasado = insumosDisponiveis.find((ins) => {
          const insNorm = this.normalizarTexto(ins.nome);
          return palavrasChave.some((p) => insNorm.includes(p));
        });
      }

      const sugestaoInsumoId = insumoCasado?.id ?? null;
      const sugestaoInsumoNome = insumoCasado?.nome ?? null;
      const sugestaoUnidadeInsumo = insumoCasado?.unidade ?? null;

      const { fator, quantidadeConvertida } = sugestaoUnidadeInsumo
        ? this.sugerirConversao(unidadeOriginal, sugestaoUnidadeInsumo, quantidadeOriginal)
        : { fator: 1, quantidadeConvertida: quantidadeOriginal };

      return {
        itemNumero,
        codigo,
        descricao,
        ncm,
        unidadeOriginal,
        quantidadeOriginal,
        valorUnitario,
        valorTotal: valorTotalItem,
        sugestaoInsumoId,
        sugestaoInsumoNome,
        sugestaoUnidadeInsumo,
        fatorConversaoSugerido: fator,
        quantidadeConvertidaSugerida: quantidadeConvertida,
      };
    });

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
