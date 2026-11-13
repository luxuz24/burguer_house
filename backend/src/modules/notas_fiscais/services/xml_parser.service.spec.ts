import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { XmlParserService, parsearNumeroXml } from './xml_parser.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('XmlParserService', () => {
  const service = new XmlParserService();

  beforeEach(async () => {
    await prisma.itemNotaFiscal.deleteMany().catch(() => {});
    await prisma.notaFiscal.deleteMany().catch(() => {});
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve processar XML de NF-e completo e extrair metadados e itens', async () => {
    // Cria insumos para testar casamento inteligente
    const bacon = await prisma.insumo.create({
      data: {
        nome: 'Bacon fatiado',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
      },
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35261012345678000199550010000012341234567890" versao="4.00">
      <ide>
        <nNF>1234</nNF>
        <serie>1</serie>
        <dhEmi>2026-10-10T14:30:00-04:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>DISTRIBUIDORA DE ALIMENTOS MS LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>BAC01</cProd>
          <xProd>BACON FATIADO EXTRA</xProd>
          <NCM>02091000</NCM>
          <uCom>KG</uCom>
          <qCom>5.0000</qCom>
          <vUnCom>30.00</vUnCom>
          <vProd>150.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>150.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>35261012345678000199550010000012341234567890</chNFe>
    </infProt>
  </protNFe>
</nfeProc>`;

    const resultado = await service.parse(xml);

    expect(resultado.chaveAcesso).toBe('35261012345678000199550010000012341234567890');
    expect(resultado.numero).toBe('1234');
    expect(resultado.fornecedor.nome).toBe('DISTRIBUIDORA DE ALIMENTOS MS LTDA');
    expect(resultado.fornecedor.cnpjCpf).toBe('12345678000199');
    expect(resultado.valorTotal).toBe(150);
    expect(resultado.itens.length).toBe(1);

    const item = resultado.itens[0]!;
    expect(item.descricao).toBe('BACON FATIADO EXTRA');
    expect(item.quantidadeOriginal).toBe(5);
    expect(item.unidadeOriginal).toBe('KG');
    expect(item.sugestaoInsumoId).toBe(bacon.id);
    expect(item.sugestaoInsumoNome).toBe('Bacon fatiado');
    expect(item.confiancaMatch).toBeGreaterThanOrEqual(70);
    // Conversão sugerida de KG para Gramas (5 * 1000 = 5000)
    expect(item.fatorConversaoSugerido).toBe(1000);
    expect(item.quantidadeConvertidaSugerida).toBe(5000);
  });

  it('deve identificar insumo por sinônimo (ex: BRIOCHE -> Pão Brioche) com alta confiança', async () => {
    const pao = await prisma.insumo.create({
      data: {
        nome: 'Pão Brioche',
        unidade: 'Unidade',
        estoqueAtual: 50,
      },
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261011111111000199550010000012341234567890" versao="4.00">
    <ide><nNF>10</nNF><dhEmi>2026-10-14T09:00:00Z</dhEmi></ide>
    <emit><xNome>Panificadora Gourmet</xNome><CNPJ>11111111000199</CNPJ></emit>
    <det nItem="1">
      <prod>
        <cProd>P01</cProd>
        <xProd>BRIOCHE PCT 30UN</xProd>
        <uCom>UN</uCom>
        <qCom>30</qCom>
        <vUnCom>1.50</vUnCom>
        <vProd>45.00</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>45.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

    const resultado = await service.parse(xml);
    const item = resultado.itens[0]!;
    expect(item.sugestaoInsumoId).toBe(pao.id);
    expect(item.sugestaoInsumoNome).toBe('Pão Brioche');
    expect(item.confiancaMatch).toBeGreaterThanOrEqual(70);
  });

  it('deve priorizar histórico anterior com 100% de confiança', async () => {
    const carne = await prisma.insumo.create({
      data: {
        nome: 'Carne de Hambúrguer',
        unidade: 'Gramas',
        estoqueAtual: 1000,
      },
    });

    // Cria nota fiscal e item previamente importado
    const nfAnterior = await prisma.notaFiscal.create({
      data: {
        chaveAcesso: '99999999999999999999999999999999999999999999',
        fornecedorNome: 'Frigorífico Especial',
        fornecedorCnpj: '99999999000199',
        valorTotal: 200,
        dataEmissao: new Date(),
        itens: {
          create: {
            descricaoOriginal: 'BLD CARNE BOV MOIDA ESP',
            unidadeOriginal: 'KG',
            quantidadeOriginal: 10,
            valorUnitario: 20,
            valorTotal: 200,
            insumoId: carne.id,
          },
        },
      },
    });
    expect(nfAnterior.id).toBeDefined();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261022222222000199550010000012341234567890" versao="4.00">
    <ide><nNF>20</nNF><dhEmi>2026-10-14T09:00:00Z</dhEmi></ide>
    <emit><xNome>Frigorífico Especial</xNome><CNPJ>99999999000199</CNPJ></emit>
    <det nItem="1">
      <prod>
        <cProd>CARNE-01</cProd>
        <xProd>BLD CARNE BOV MOIDA ESP</xProd>
        <uCom>KG</uCom>
        <qCom>15</qCom>
        <vUnCom>20</vUnCom>
        <vProd>300</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>300.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

    const resultado = await service.parse(xml);
    const item = resultado.itens[0]!;
    expect(item.sugestaoInsumoId).toBe(carne.id);
    expect(item.confiancaMatch).toBe(100);
    expect(item.motivoMatch).toBe('HISTORICO');
  });

  it('deve listar outrasSugestoes quando múltiplos insumos forem compatíveis', async () => {
    await prisma.insumo.create({
      data: { nome: 'Cebola branca', unidade: 'Gramas', estoqueAtual: 100 },
    });
    await prisma.insumo.create({
      data: { nome: 'Cebola Roxa', unidade: 'Gramas', estoqueAtual: 100 },
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261033333333000199550010000012341234567890" versao="4.00">
    <ide><nNF>30</nNF><dhEmi>2026-10-14T09:00:00Z</dhEmi></ide>
    <emit><xNome>Hortifrúti Central</xNome><CNPJ>33333333000199</CNPJ></emit>
    <det nItem="1">
      <prod>
        <cProd>CEB-01</cProd>
        <xProd>CEBOLA NACIONAL SC 20KG</xProd>
        <uCom>KG</uCom>
        <qCom>20</qCom>
        <vUnCom>4.5</vUnCom>
        <vProd>90.0</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>90.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

    const resultado = await service.parse(xml);
    const item = resultado.itens[0]!;
    expect(item.sugestaoInsumoId).toBeDefined();
    expect(item.outrasSugestoes && item.outrasSugestoes.length).toBeGreaterThanOrEqual(1);
  });

  it('deve lançar erro se o conteúdo XML for inválido ou não contiver tag <NFe>', async () => {
    await expect(service.parse('')).rejects.toThrow('Conteúdo XML vazio ou inválido');
    await expect(service.parse('<teste>invalido</teste>')).rejects.toThrow('XML não contém a tag raiz <NFe> válida');
  });

  it('deve extrair valores numéricos com vírgula decimal de forma resiliente', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261044444444000199550010000012341234567890" versao="4.00">
    <ide><nNF>42</nNF><dhEmi>2026-10-14T09:00:00Z</dhEmi></ide>
    <emit><xNome>Distribuidora Regional</xNome><CNPJ>44444444000199</CNPJ></emit>
    <det nItem="1">
      <prod>
        <cProd>PROD-01</cProd>
        <xProd>TOMATE SELECIONADO</xProd>
        <uCom>KG</uCom>
        <qCom>2,500</qCom>
        <vUnCom>10,50</vUnCom>
        <vProd>26,25</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>26,25</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

    const resultado = await service.parse(xml);
    const item = resultado.itens[0]!;
    expect(item.quantidadeOriginal).toBe(2.5);
    expect(item.valorUnitario).toBe(10.5);
    expect(item.valorTotal).toBe(26.25);
    expect(resultado.valorTotal).toBe(26.25);
  });

  it('deve sugerir conversão de unidades canônicas e sinalizar conversaoIncerta para unidades desconhecidas', () => {
    expect(service.sugerirConversao('QUILOS', 'GRAMAS', 2)).toEqual({ fator: 1000, quantidadeConvertida: 2000, conversaoIncerta: false });
    expect(service.sugerirConversao('KG', 'GRAMAS', 1.5)).toEqual({ fator: 1000, quantidadeConvertida: 1500, conversaoIncerta: false });
    expect(service.sugerirConversao('KILOGRAMA', 'GRAMAS', 3)).toEqual({ fator: 1000, quantidadeConvertida: 3000, conversaoIncerta: false });
    expect(service.sugerirConversao('LTS', 'MILILITROS', 1)).toEqual({ fator: 1000, quantidadeConvertida: 1000, conversaoIncerta: false });
    expect(service.sugerirConversao('LITROS', 'MILILITROS', 3)).toEqual({ fator: 1000, quantidadeConvertida: 3000, conversaoIncerta: false });
    expect(service.sugerirConversao('ML', 'LITROS', 500)).toEqual({ fator: 0.001, quantidadeConvertida: 0.5, conversaoIncerta: false });
    expect(service.sugerirConversao('UN', 'UNIDADES', 10)).toEqual({ fator: 1, quantidadeConvertida: 10, conversaoIncerta: false });
    expect(service.sugerirConversao('QUILOS', 'KG', 5)).toEqual({ fator: 1, quantidadeConvertida: 5, conversaoIncerta: false });

    // Unidades desconhecidas (ex: CX, PCT) ou incompatíveis: adota 1:1 mas com conversaoIncerta: true
    expect(service.sugerirConversao('CX', 'UNIDADE', 2)).toEqual({ fator: 1, quantidadeConvertida: 2, conversaoIncerta: true });
    expect(service.sugerirConversao('FARDO', 'GRAMAS', 1)).toEqual({ fator: 1, quantidadeConvertida: 1, conversaoIncerta: true });
  });

  it('deve sinalizar itens inválidos com erro em vez de zerar silenciosamente', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261055555555000199550010000012341234567890" versao="4.00">
    <ide><nNF>55</nNF><dhEmi>2026-10-14T09:00:00Z</dhEmi></ide>
    <emit><xNome>Fornecedor Teste</xNome><CNPJ>55555555000199</CNPJ></emit>
    <det nItem="1">
      <prod>
        <cProd>ERR-01</cProd>
        <xProd>ITEM COM QUANTIDADE INVALIDA</xProd>
        <uCom>UN</uCom>
        <qCom>abc</qCom>
        <vUnCom>10.0</vUnCom>
        <vProd>0</vProd>
      </prod>
    </det>
    <det nItem="2">
      <prod>
        <cProd>OK-01</cProd>
        <xProd>ITEM VALIDO</xProd>
        <uCom>UN</uCom>
        <qCom>5</qCom>
        <vUnCom>10.0</vUnCom>
        <vProd>50.0</vProd>
      </prod>
    </det>
    <total><ICMSTot><vNF>50.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

    const resultado = await service.parse(xml);
    expect(resultado.totalItensComErro).toBe(1);
    expect(resultado.itens[0]?.erro).toBeDefined();
    expect(resultado.itens[0]?.erro).toContain('Valor numérico inválido');
    expect(resultado.itens[1]?.erro).toBeUndefined();
  });

  it('omite dataEmissao quando o XML não traz dhEmi/dEmi ou quando o valor é inválido', async () => {
    const xmlSemData = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe35261055555555000199550010000012341234567891" versao="4.00">
    <ide><nNF>56</nNF></ide>
    <emit><xNome>Fornecedor Sem Data</xNome><CNPJ>55555555000199</CNPJ></emit>
    <det nItem="1">
      <prod><cProd>OK-01</cProd><xProd>ITEM</xProd><uCom>UN</uCom><qCom>1</qCom><vUnCom>10</vUnCom><vProd>10</vProd></prod>
    </det>
    <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;
    const semData = await service.parse(xmlSemData);
    expect(semData.dataEmissao).toBeUndefined();
    expect('dataEmissao' in semData).toBe(false);

    const xmlDataInvalida = xmlSemData.replace('<ide><nNF>56</nNF></ide>', '<ide><nNF>56</nNF><dhEmi>31/02/2026</dhEmi></ide>');
    const dataInvalida = await service.parse(xmlDataInvalida);
    expect(dataInvalida.dataEmissao).toBeUndefined();
    expect('dataEmissao' in dataInvalida).toBe(false);

    const xmlFev31 = xmlSemData.replace('<ide><nNF>56</nNF></ide>', '<ide><nNF>56</nNF><dhEmi>2026-02-31T10:30:00</dhEmi></ide>');
    const fev31 = await service.parse(xmlFev31);
    expect(fev31.dataEmissao).toBeUndefined();
    expect('dataEmissao' in fev31).toBe(false);
  });
});

describe('parsearNumeroXml', () => {
  it('parseia números válidos padrão XML e com vírgula legada', () => {
    expect(parsearNumeroXml('2.50')).toEqual({ valor: 2.5, valido: true });
    expect(parsearNumeroXml('2,5')).toEqual({ valor: 2.5, valido: true });
    expect(parsearNumeroXml(10.75)).toEqual({ valor: 10.75, valido: true });
    expect(parsearNumeroXml('0')).toEqual({ valor: 0, valido: true });
  });

  it('sinaliza valores inválidos em vez de mascarar silenciosamente como zero', () => {
    expect(parsearNumeroXml('abc').valido).toBe(false);
    expect(parsearNumeroXml('1.234,56').valido).toBe(false);
    expect(parsearNumeroXml('').valido).toBe(false);
    expect(parsearNumeroXml(null).valido).toBe(false);
    expect(parsearNumeroXml(-5).valido).toBe(false);
  });
});
