import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

const USER_ID = 'user-saida-dia-http';

async function limparBanco() {
  await prisma.movimentacaoEstoque.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.notaFiscal.deleteMany().catch(() => {});
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('GET /api/estoque/saida-dia', () => {
  let auth: Record<string, string>;

  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: USER_ID },
      update: { ativo: true, tokenVersion: 0, nome: 'Operador Saída' },
      create: { id: USER_ID, nome: 'Operador Saída', email: 'saida.http@teste.com', senha: 'hash', role: 'OPERADOR', ativo: true, tokenVersion: 0 },
    });
    auth = { authorization: `Bearer ${app.jwt.sign({ sub: USER_ID, email: 'saida.http@teste.com', role: 'OPERADOR', tv: 0 })}` };
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: USER_ID } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('exige JWT (401) e valida a data (400)', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/estoque/saida-dia' })).statusCode).toBe(401);
    for (const data of ['2026-02-31', 'abc', '']) {
      const r = await app.inject({ method: 'GET', url: `/api/estoque/saida-dia?data=${data}`, headers: auth });
      expect(r.statusCode).toBe(400);
      expect(r.json().message).toBe('Data inválida; use o formato AAAA-MM-DD');
    }
  });

  it('devolve pedidos, itens e insumos do dia, sem chaves de valor em R$', async () => {
    const ins = await prisma.insumo.create({ data: { nome: 'Pão HTTP Saída', unidade: 'Unidade', estoqueAtual: 40, estoqueMinimo: 5 } });
    await prisma.produto.create({ data: { nome: 'Burger HTTP Saída', fichasTecnicas: { create: [{ insumoId: ins.id, quantidade: 1 }] } } });
    await prisma.venda.create({
      data: {
        externalId: 'hook-http-saida',
        origem: 'WEBHOOK',
        ocorridoEm: new Date('2026-01-10T15:00:00.000Z'),
        processado: true,
        payloadOriginal: { info: { id: 'hook-http-saida', check: 1, items: [{ name: 'Burger HTTP Saída', quantity: 3, price: 25 }] } },
      },
    });

    const r = await app.inject({ method: 'GET', url: '/api/estoque/saida-dia?data=2026-01-10', headers: auth });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      data: '2026-01-10',
      pedidos: 1,
      itens: [{ nome: 'Burger HTTP Saída', quantidade: 3 }],
      insumos: [
        {
          insumoId: ins.id, nome: 'Pão HTTP Saída', unidade: 'Unidade', categoria: 'INGREDIENTE',
          quantidadeSaiu: 3, estoqueAtual: 40, estoqueMinimo: 5, emAlerta: false,
        },
      ],
    });
  });
});
