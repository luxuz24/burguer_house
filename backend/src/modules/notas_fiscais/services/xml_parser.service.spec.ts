import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { XmlParserService } from './xml_parser.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('XmlParserService', () => {
  const service = new XmlParserService();

  beforeEach(async () => {
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
    // Conversão sugerida de KG para Gramas (5 * 1000 = 5000)
    expect(item.fatorConversaoSugerido).toBe(1000);
    expect(item.quantidadeConvertidaSugerida).toBe(5000);
  });

  it('deve lançar erro se o conteúdo XML for inválido ou não contiver tag <NFe>', async () => {
    await expect(service.parse('')).rejects.toThrow('Conteúdo XML vazio ou inválido');
    await expect(service.parse('<teste>invalido</teste>')).rejects.toThrow('XML não contém a tag raiz <NFe> válida');
  });
});
