import * as cheerio from 'cheerio';
import { prisma } from '../../../infra/database/prisma.js';
import { XmlParserService, type ItemNFeExtraido, type InsumoBasico } from './xml_parser.service.js';

export interface QrcodeParseResult {
  chaveAcesso: string;
  sucessoScraping: boolean;
  mensagem?: string | undefined;
  fornecedor: {
    nome: string;
    cnpjCpf: string;
  };
  numero?: string | undefined;
  serie?: string | undefined;
  dataEmissao?: string | undefined;
  valorTotal: number;
  itens: ItemNFeExtraido[];
}

export class QrcodeParserService {
  private xmlParserService = new XmlParserService();

  extrairChaveAcesso(entrada: string): string | null {
    if (!entrada || typeof entrada !== 'string') return null;

    // Busca padrão de 44 dígitos contínuos (padrão oficial de chave NF-e/NFC-e)
    const match = entrada.match(/(?:p=|chNFe=|chNFe%3D)?([0-9]{44})/i);
    if (match && match[1]) {
      return match[1];
    }

    const any44 = entrada.match(/([0-9]{44})/);
    return any44 ? any44[1]! : null;
  }

  parseHtmlSefaz(html: string): {
    fornecedorNome: string;
    fornecedorCnpj: string;
    valorTotal: number;
    numero?: string;
    serie?: string;
    itensBrutos: Array<{
      descricao: string;
      codigo: string;
      unidade: string;
      quantidade: number;
      valorUnitario: number;
      valorTotal: number;
    }>;
  } | null {
    try {
      const $ = cheerio.load(html);

      // 1. Extração do Fornecedor / Emitente
      let fornecedorNome = $('.txtTopo').first().text().trim() ||
        $('#u20').first().text().trim() ||
        $('div.ui-header h1').text().trim() ||
        $('.conteudoLinha').first().text().trim() ||
        'Fornecedor NFC-e';

      // Limpa possíveis quebras de linha múltiplas
      fornecedorNome = fornecedorNome.replace(/\s+/g, ' ');

      // Busca CNPJ no documento
      const cnpjMatch = html.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      const fornecedorCnpj = cnpjMatch ? cnpjMatch[1]!.replace(/\D/g, '') : '';

      // 2. Extração de Totais
      let valorTotal = 0;
      const totalText = $('.txtMax').first().text().trim() ||
        $('.totalNFe .txtValor').first().text().trim() ||
        $('.RTotal').last().text().trim();

      if (totalText) {
        const valMatch = totalText.match(/([\d\.,]+)/);
        if (valMatch && valMatch[1]) {
          valorTotal = parseFloat(valMatch[1].replace(/\./g, '').replace(',', '.')) || 0;
        }
      }

      // 3. Extração dos Itens da Tabela da SEFAZ
      const itensBrutos: Array<{
        descricao: string;
        codigo: string;
        unidade: string;
        quantidade: number;
        valorUnitario: number;
        valorTotal: number;
      }> = [];

      // Padrão 1: Tabela #tabResult tr (Padrão Nacional e maioria dos estados como MS, SP, RS, etc)
      $('#tabResult tr, table.tabelaItens tr').each((_, el) => {
        const row = $(el);
        const descricao = row.find('span.txtTit').text().trim() || row.find('.fixo-prod-tit-desc').text().trim();
        if (!descricao) return;

        // Código (ex: "Código: 123456")
        const codText = row.find('span.RCod').text().trim();
        const codMatch = codText.match(/\(?Código:?\s*([^\)]+)\)?/i);
        const codigo = codMatch && codMatch[1] ? codMatch[1].trim() : '';

        // Quantidade (ex: "Qtde.: 2,0000")
        const qtdText = row.find('span.Rqtd').text().trim();
        const qtdMatch = qtdText.match(/Qtde\.?:?\s*([\d\.,]+)/i);
        const quantidade = qtdMatch && qtdMatch[1]
          ? parseFloat(qtdMatch[1].replace(/\./g, '').replace(',', '.'))
          : 1;

        // Unidade (ex: "UN: KG" ou "UN: UN")
        const unText = row.find('span.RUN').text().trim();
        const unMatch = unText.match(/UN:?\s*([A-Za-z0-9]+)/i);
        const unidade = unMatch && unMatch[1] ? unMatch[1].toUpperCase().trim() : 'UN';

        // Valor Unitário (ex: "Vl. Unit.: 15,90")
        const vuText = row.find('span.RvlUnit').text().trim();
        const vuMatch = vuText.match(/Vl\.\s*Unit\.?:?\s*([\d\.,]+)/i);
        const valorUnitario = vuMatch && vuMatch[1]
          ? parseFloat(vuMatch[1].replace(/\./g, '').replace(',', '.'))
          : 0;

        // Valor Total do Item (ex: "Vl. Total: 31,80")
        const vtText = row.find('span.valor, span.RTotal').text().trim();
        const vtMatch = vtText.match(/([\d\.,]+)/);
        const valorTotalItem = vtMatch && vtMatch[1]
          ? parseFloat(vtMatch[1].replace(/\./g, '').replace(',', '.'))
          : quantidade * valorUnitario;

        itensBrutos.push({
          descricao,
          codigo,
          unidade,
          quantidade,
          valorUnitario,
          valorTotal: valorTotalItem,
        });
      });

      if (itensBrutos.length === 0) {
        return null;
      }

      return {
        fornecedorNome,
        fornecedorCnpj,
        valorTotal: valorTotal || itensBrutos.reduce((acc, i) => acc + i.valorTotal, 0),
        itensBrutos,
      };
    } catch {
      return null;
    }
  }

  async processarQrCode(urlOuChave: string): Promise<QrcodeParseResult> {
    if (!urlOuChave || typeof urlOuChave !== 'string') {
      throw new Error('QR Code ou Chave de Acesso não fornecida');
    }

    const entradaLimpa = urlOuChave.trim();
    const chaveAcesso = this.extrairChaveAcesso(entradaLimpa);

    if (!chaveAcesso) {
      throw new Error('Não foi possível identificar uma chave de acesso válida de 44 dígitos no QR Code');
    }

    // Se for URL, tenta buscar a página da SEFAZ
    const isUrl = entradaLimpa.startsWith('http://') || entradaLimpa.startsWith('https://');

    if (isUrl) {
      try {
        const response = await fetch(entradaLimpa, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          signal: AbortSignal.timeout(8000), // 8 segundos de timeout
        });

        if (response.ok) {
          const html = await response.text();
          const parsed = this.parseHtmlSefaz(html);

          if (parsed && parsed.itensBrutos.length > 0) {
            // Busca todos os insumos para casamento inteligente
            const insumosDisponiveis: InsumoBasico[] = await prisma.insumo.findMany({
              select: { id: true, nome: true, unidade: true },
            });

            const itens: ItemNFeExtraido[] = [];

            for (let i = 0; i < parsed.itensBrutos.length; i++) {
              const ib = parsed.itensBrutos[i]!;
              const match = await this.xmlParserService.encontrarMelhorMatch(ib.descricao, insumosDisponiveis);
              const { fator, quantidadeConvertida } = match.unidade
                ? this.xmlParserService.sugerirConversao(ib.unidade, match.unidade, ib.quantidade)
                : { fator: 1, quantidadeConvertida: ib.quantidade };

              itens.push({
                itemNumero: i + 1,
                codigo: ib.codigo,
                descricao: ib.descricao,
                ncm: '',
                unidadeOriginal: ib.unidade,
                quantidadeOriginal: ib.quantidade,
                valorUnitario: ib.valorUnitario,
                valorTotal: ib.valorTotal,
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
              chaveAcesso,
              sucessoScraping: true,
              fornecedor: {
                nome: parsed.fornecedorNome,
                cnpjCpf: parsed.fornecedorCnpj,
              },
              valorTotal: parsed.valorTotal,
              dataEmissao: new Date().toISOString(),
              itens,
            };
          }
        }
      } catch {
        // Falha no scraping da SEFAZ cai no fallback gracioso abaixo
      }
    }

    // Fallback: SEFAZ bloqueou ou layout diferente
    return {
      chaveAcesso,
      sucessoScraping: false,
      mensagem:
        'Chave de acesso extraída com sucesso! No entanto, a consulta automática na SEFAZ não retornou os itens (pode exigir CAPTCHA ou estar indisponível). Você pode vincular os itens ou carregar o XML.',
      fornecedor: {
        nome: 'Fornecedor da NFC-e',
        cnpjCpf: '',
      },
      valorTotal: 0,
      itens: [],
    };
  }
}
