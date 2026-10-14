import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { QrcodeParserService } from './qrcode_parser.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('QrcodeParserService', () => {
  const service = new QrcodeParserService();

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

  it('deve extrair a chave de acesso de 44 dígitos de URLs de NFC-e de diferentes padrões', () => {
    const urlMs = 'http://www.dfe.ms.gov.br/nfce/qrcode?p=50261012345678000199650010000012341234567890|2|1|1|ABCD';
    const chaveMs = service.extrairChaveAcesso(urlMs);
    expect(chaveMs).toBe('50261012345678000199650010000012341234567890');

    const urlSp = 'https://www.nfce.fazenda.sp.gov.br/consulta?chNFe=35261012345678000199650010000012341234567890';
    const chaveSp = service.extrairChaveAcesso(urlSp);
    expect(chaveSp).toBe('35261012345678000199650010000012341234567890');

    const chaveDireta = '35261012345678000199650010000012341234567890';
    expect(service.extrairChaveAcesso(chaveDireta)).toBe('35261012345678000199650010000012341234567890');

    expect(service.extrairChaveAcesso('invalida')).toBeNull();
  });

  it('deve fazer o parsing do HTML da SEFAZ extraindo emitente, totais e itens', () => {
    const htmlSefaz = `
    <html>
      <body>
        <div class="txtTopo">SUPERMERCADO ATACADAO LTDA</div>
        <div class="conteudoLinha">CNPJ: 12.345.678/0001-99</div>
        <table id="tabResult">
          <tr id="Item + 1">
            <td class="fixo-prod-tit-desc">
              <span class="txtTit">QUEIJO CHEDDAR FATIADO</span>
              <span class="RCod">(Código: 1001)</span>
            </td>
            <td>
              <span class="Rqtd">Qtde.: 2,500</span>
              <span class="RUN">UN: KG</span>
              <span class="RvlUnit">Vl. Unit.: 40,00</span>
              <span class="valor">100,00</span>
            </td>
          </tr>
          <tr id="Item + 2">
            <td class="fixo-prod-tit-desc">
              <span class="txtTit">PAO BRIOCHE HAMBURGUER 30UN</span>
              <span class="RCod">(Código: 2002)</span>
            </td>
            <td>
              <span class="Rqtd">Qtde.: 3,000</span>
              <span class="RUN">UN: UN</span>
              <span class="RvlUnit">Vl. Unit.: 18,00</span>
              <span class="valor">54,00</span>
            </td>
          </tr>
        </table>
        <div class="txtMax">Total: R$ 154,00</div>
      </body>
    </html>
    `;

    const parsed = service.parseHtmlSefaz(htmlSefaz);
    expect(parsed).not.toBeNull();
    expect(parsed?.fornecedorNome).toContain('SUPERMERCADO ATACADAO LTDA');
    expect(parsed?.fornecedorCnpj).toBe('12345678000199');
    expect(parsed?.valorTotal).toBe(154.0);
    expect(parsed?.itensBrutos.length).toBe(2);

    expect(parsed?.itensBrutos[0]?.descricao).toBe('QUEIJO CHEDDAR FATIADO');
    expect(parsed?.itensBrutos[0]?.quantidade).toBe(2.5);
    expect(parsed?.itensBrutos[0]?.unidade).toBe('KG');
    expect(parsed?.itensBrutos[0]?.valorUnitario).toBe(40.0);
    expect(parsed?.itensBrutos[0]?.valorTotal).toBe(100.0);
  });

  it('deve fornecer fallback gracioso quando a SEFAZ não estiver acessível', async () => {
    const chave = '35261012345678000199650010000012341234567890';
    const resultado = await service.processarQrCode(chave);

    expect(resultado.chaveAcesso).toBe(chave);
    expect(resultado.sucessoScraping).toBe(false);
    expect(resultado.mensagem).toBeDefined();
    expect(resultado.itens).toEqual([]);
  });

  it('deve lançar erro se a chave/URL não contiver 44 dígitos', async () => {
    await expect(service.processarQrCode('http://site.com/semchave')).rejects.toThrow(
      'Não foi possível identificar uma chave de acesso válida de 44 dígitos no QR Code'
    );
  });
});
