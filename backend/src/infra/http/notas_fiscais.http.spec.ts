import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

let auth: { authorization: string };

async function limpar() {
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.notaFiscal.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('Notas Fiscais HTTP API (/api/notas-fiscais)', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u-nf-spec' },
      update: { role: 'ADMIN', ativo: true, tokenVersion: 0 },
      create: {
        id: 'u-nf-spec',
        nome: 'Operador NF',
        email: 'nf-spec@test.local',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({ sub: 'u-nf-spec', email: 'nf-spec@test.local', role: 'ADMIN', tv: 0 })}`,
    };
  });

  beforeEach(limpar);

  afterAll(async () => {
    await limpar();
    await prisma.usuario.deleteMany({ where: { id: 'u-nf-spec' } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('POST /api/notas-fiscais/confirmar — validação de dataEmissao', () => {
    it('rejeita dataEmissao fora de ISO 8601 (ex.: "31/02/2026" ou "2026-02-31") com 400 e issues', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Bacon NF HTTP', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 0, estoqueMinimo: 0 },
      });

      for (const dataInvalida of ['31/02/2026', '2026-02-31', '']) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/notas-fiscais/confirmar',
          headers: auth,
          payload: {
            chaveAcesso: '35261012345678000199550010000012341234567810',
            dataEmissao: dataInvalida,
            itens: [{ insumoId: insumo.id, quantidade: 500 }],
          },
        });
        expect(res.statusCode, `data=${dataInvalida}`).toBe(400);
        expect(res.json().issues.length).toBeGreaterThan(0);
      }

      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).estoqueAtual).toBe(0);
    });

    it('aceita dataEmissao ISO 8601 válida e grava exatamente; ausente usa data atual', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Queijo NF HTTP', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 0, estoqueMinimo: 0 },
      });

      const dataIso = '2026-11-10T14:30:00-04:00';
      const comData = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/confirmar',
        headers: auth,
        payload: {
          chaveAcesso: '35261012345678000199550010000012341234567811',
          dataEmissao: dataIso,
          itens: [{ insumoId: insumo.id, quantidade: 200 }],
        },
      });
      expect(comData.statusCode).toBe(200);
      const notaComData = await prisma.notaFiscal.findUniqueOrThrow({
        where: { chaveAcesso: '35261012345678000199550010000012341234567811' },
      });
      expect(notaComData.dataEmissao.toISOString()).toBe(new Date(dataIso).toISOString());

      const antes = Date.now();
      const semData = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/confirmar',
        headers: auth,
        payload: {
          chaveAcesso: '35261012345678000199550010000012341234567812',
          itens: [{ insumoId: insumo.id, quantidade: 100 }],
        },
      });
      const depois = Date.now();
      expect(semData.statusCode).toBe(200);
      const notaSemData = await prisma.notaFiscal.findUniqueOrThrow({
        where: { chaveAcesso: '35261012345678000199550010000012341234567812' },
      });
      expect(notaSemData.dataEmissao.getTime()).toBeGreaterThanOrEqual(antes - 1000);
      expect(notaSemData.dataEmissao.getTime()).toBeLessThanOrEqual(depois + 1000);
    });

    it('fluxo parser-xml -> confirmar aceita dhEmi sem fuso (convertido para America/Campo_Grande) e dEmi, e omite/rejeita 2026-02-31', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Pao NF Fluxo', unidade: 'Unidade', fatorPerda: 0, estoqueAtual: 0, estoqueMinimo: 0 },
      });

      const montarXml = (ideTag: string, nNf: string) => `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe3526101234567800019955001000001234123456${nNf}" versao="4.00">
    <ide><nNF>${nNf}</nNF>${ideTag}</ide>
    <emit><xNome>Fornecedor Fluxo</xNome><CNPJ>12345678000199</CNPJ></emit>
    <det nItem="1"><prod><cProd>P1</cProd><xProd>Pao</xProd><uCom>UN</uCom><qCom>10</qCom><vUnCom>2</vUnCom><vProd>20</vProd></prod></det>
    <total><ICMSTot><vNF>20.00</vNF></ICMSTot></total>
  </infNFe>
</NFe>`;

      // 1. dhEmi sem fuso -> parser devolve ISO com offset -> confirmar responde 200
      const parseSemFuso = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/parser-xml',
        headers: auth,
        payload: { xml: montarXml('<dhEmi>2026-11-12T10:30:00</dhEmi>', '9901') },
      });
      expect(parseSemFuso.statusCode).toBe(200);
      const dataParseada = parseSemFuso.json().dataEmissao;
      expect(dataParseada).toMatch(/^2026-11-12T10:30:00[+-]\d{2}:\d{2}$/);

      const confirmarSemFuso = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/confirmar',
        headers: auth,
        payload: {
          chaveAcesso: '35261012345678000199550010000012341234569901',
          dataEmissao: dataParseada,
          itens: [{ insumoId: insumo.id, quantidade: 10 }],
        },
      });
      expect(confirmarSemFuso.statusCode).toBe(200);
      const notaSemFuso = await prisma.notaFiscal.findUniqueOrThrow({
        where: { chaveAcesso: '35261012345678000199550010000012341234569901' },
      });
      expect(notaSemFuso.dataEmissao.toISOString()).toBe('2026-11-12T14:30:00.000Z');

      // 2. dEmi (só data) -> parser devolve AAAA-MM-DD -> confirmar responde 200
      const parseSoData = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/parser-xml',
        headers: auth,
        payload: { xml: montarXml('<dEmi>2026-11-12</dEmi>', '9902') },
      });
      expect(parseSoData.statusCode).toBe(200);
      expect(parseSoData.json().dataEmissao).toBe('2026-11-12');

      const confirmarSoData = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/confirmar',
        headers: auth,
        payload: {
          chaveAcesso: '35261012345678000199550010000012341234569902',
          dataEmissao: parseSoData.json().dataEmissao,
          itens: [{ insumoId: insumo.id, quantidade: 10 }],
        },
      });
      expect(confirmarSoData.statusCode).toBe(200);

      // 3. Data inexistente 2026-02-31 -> omitida pelo parser e rejeitada na confirmação
      const parseInexistente = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/parser-xml',
        headers: auth,
        payload: { xml: montarXml('<dEmi>2026-02-31</dEmi>', '9903') },
      });
      expect(parseInexistente.statusCode).toBe(200);
      expect(parseInexistente.json().dataEmissao).toBeUndefined();

      const confirmarInexistente = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/confirmar',
        headers: auth,
        payload: {
          chaveAcesso: '35261012345678000199550010000012341234569903',
          dataEmissao: '2026-02-31',
          itens: [{ insumoId: insumo.id, quantidade: 10 }],
        },
      });
      expect(confirmarInexistente.statusCode).toBe(400);
    });
  });
});
