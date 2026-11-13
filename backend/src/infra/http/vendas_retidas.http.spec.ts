import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

let auth: { authorization: string };

async function limpar() {
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('GET /api/vendas/retidas', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1-retidas' },
      update: { ativo: true, tokenVersion: 0 },
      create: {
        id: 'u1-retidas',
        nome: 'Operador Teste',
        email: 'retidas@app-spec.test',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: 'u1-retidas',
        email: 'retidas@app-spec.test',
        role: 'OPERADOR',
        tv: 0,
      })}`,
    };
  });

  beforeEach(async () => {
    vi.unstubAllEnvs();
    await limpar();
  });

  afterAll(async () => {
    await limpar();
    await prisma.usuario.deleteMany({ where: { id: 'u1-retidas' } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('retorna 401 sem token JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vendas/retidas' });
    expect(res.statusCode).toBe(401);
  });

  it('lista só vendas retidas com motivo, conta aguardandoEstado separado e esvazia após corrigir cardápio e consolidar', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron');

    const vendaRetida = await prisma.venda.create({
      data: {
        externalId: 'ped-retido-1',
        payloadOriginal: {
          id: 'ped-retido-1',
          check: 1,
          info: { items: [{ name: 'X-Tudo Especial', quantity: 2, price: 32 }] },
        },
      },
    });

    await prisma.venda.create({
      data: {
        externalId: 'ped-cancelado-1',
        payloadOriginal: {
          id: 'ped-cancelado-1',
          check: 4,
          info: { items: [{ name: 'Qualquer Coisa', quantity: 1, price: 20 }] },
        },
      },
    });

    await prisma.venda.create({
      data: {
        externalId: 'ped-agendado-1',
        payloadOriginal: {
          id: 'ped-agendado-1',
          check: -2,
          info: { items: [{ name: 'Outro Lanche', quantity: 1, price: 25 }] },
        },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/vendas/retidas',
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.aguardandoEstado).toBe(1);
    expect(body.totalRetidas).toBe(1);
    expect(body.retidas).toHaveLength(1);
    expect(body.retidas[0]).toMatchObject({
      id: vendaRetida.id,
      externalId: 'ped-retido-1',
      check: 1,
      motivos: [{ tipo: 'PRODUTO_NAO_ENCONTRADO', detalhe: 'X-Tudo Especial' }],
    });
    expect(body.resumoPorProduto).toEqual([
      { produto: 'X-Tudo Especial', tipo: 'PRODUTO_NAO_ENCONTRADO', vendas: 1 },
    ]);

    // Cadastra o produto faltante + ficha técnica e dispara consolidação
    const insumo = await prisma.insumo.create({
      data: { nome: 'Pão Brioche', unidade: 'Unidade', fatorPerda: 0, estoqueAtual: 10, estoqueMinimo: 2 },
    });
    const produto = await prisma.produto.create({ data: { nome: 'X-Tudo Especial' } });
    await prisma.fichaTecnica.create({
      data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 1 },
    });

    const cons = await app.inject({
      method: 'POST',
      url: '/api/vendas/consolidar',
      headers: { 'x-cron-secret': 'segredo-do-cron' },
    });
    expect(cons.statusCode).toBe(200);
    expect(cons.json().consolidadas).toBe(2); // retida + cancelada

    const apos = await app.inject({
      method: 'GET',
      url: '/api/vendas/retidas',
      headers: auth,
    });
    expect(apos.statusCode).toBe(200);
    expect(apos.json().retidas).toEqual([]);
    expect(apos.json().totalRetidas).toBe(0);
    expect(apos.json().aguardandoEstado).toBe(1);
  });
});
