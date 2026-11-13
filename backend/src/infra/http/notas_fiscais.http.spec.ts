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
      update: { ativo: true, tokenVersion: 0 },
      create: {
        id: 'u-nf-spec',
        nome: 'Operador NF',
        email: 'nf-spec@test.local',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({ sub: 'u-nf-spec', email: 'nf-spec@test.local', role: 'OPERADOR', tv: 0 })}`,
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
  });
});
