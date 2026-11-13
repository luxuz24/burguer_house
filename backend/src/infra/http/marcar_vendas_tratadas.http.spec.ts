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

describe('POST /api/vendas/marcar-tratadas', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1-tratadas' },
      update: { ativo: true, tokenVersion: 0 },
      create: {
        id: 'u1-tratadas',
        nome: 'Operador Tratadas',
        email: 'tratadas@app-spec.test',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: 'u1-tratadas',
        email: 'tratadas@app-spec.test',
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
    await prisma.usuario.deleteMany({ where: { id: 'u1-tratadas' } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('retorna 401 sem token JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      payload: { ate: '2026-11-10', motivo: 'Modo sombra finalizado' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejeita data inexistente (2026-02-31) ou motivo vazio com 400', async () => {
    const resDataInvalida = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: '2026-02-31', motivo: 'Fechamento manual' },
    });
    expect(resDataInvalida.statusCode).toBe(400);

    const resMotivoVazio = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: '2026-11-10', motivo: '   ' },
    });
    expect(resMotivoVazio.statusCode).toBe(400);
  });

  it('marca vendas pendentes até o fim do dia no fuso da loja sem abater estoque, é idempotente e preserva vendas posteriores para consolidação', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron');

    const insumo = await prisma.insumo.create({
      data: { nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 10, estoqueMinimo: 2 },
    });
    const produto = await prisma.produto.create({
      data: { nome: 'X-Burger' },
    });
    await prisma.fichaTecnica.create({
      data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 1 },
    });

    const payloadAntes = {
      id: 'ped-antes',
      check: 1,
      info: { items: [{ name: 'X-Burger', quantity: 1, price: 28 }] },
    };
    const payloadDepois = {
      id: 'ped-depois',
      check: 1,
      info: { items: [{ name: 'X-Burger', quantity: 1, price: 28 }] },
    };

    // 23:59:59 em Campo Grande (UTC-4) = 2026-11-11T03:59:59.000Z (ainda dia 10 na loja)
    const vendaAntes = await prisma.venda.create({
      data: {
        externalId: 'ped-antes',
        payloadOriginal: payloadAntes,
        criadoEm: new Date('2026-11-11T03:59:59.000Z'),
      },
    });

    // 00:05:00 em Campo Grande (UTC-4) = 2026-11-11T04:05:00.000Z (já dia 11 na loja)
    const vendaDepois = await prisma.venda.create({
      data: {
        externalId: 'ped-depois',
        payloadOriginal: payloadDepois,
        criadoEm: new Date('2026-11-11T04:05:00.000Z'),
      },
    });

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: {
        ate: '2026-11-10',
        motivo: 'Modo sombra encerrado após inventário manual',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ marcadas: 1, ate: '2026-11-10' });

    // Chamada repetida na mesma data não altera nada (idempotência)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: {
        ate: '2026-11-10',
        motivo: 'Segunda tentativa idempotente',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ marcadas: 0, ate: '2026-11-10' });

    // Estoque não foi abatido pela marcação
    const insumoAposMarcar = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } });
    expect(insumoAposMarcar.estoqueAtual).toBe(10);

    // Payload preservado com metadados de auditoria em _tratamento
    const vendaAntesDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaAntes.id } });
    expect(vendaAntesDb.processado).toBe(true);
    expect(vendaAntesDb.payloadOriginal).toMatchObject({
      ...payloadAntes,
      _tratamento: {
        motivo: 'Modo sombra encerrado após inventário manual',
        ate: '2026-11-10',
      },
    });
    expect(typeof (vendaAntesDb.payloadOriginal as any)._tratamento.marcadoEm).toBe('string');

    // A venda posterior continua pendente antes da consolidação
    const vendaDepoisAntesConsolidar = await prisma.venda.findUniqueOrThrow({ where: { id: vendaDepois.id } });
    expect(vendaDepoisAntesConsolidar.processado).toBe(false);

    // Consolidação subsequente abate APENAS a venda posterior (10 -> 9)
    const resConsolidar = await app.inject({
      method: 'POST',
      url: '/api/vendas/consolidar',
      headers: { 'x-cron-secret': 'segredo-do-cron' },
    });
    expect(resConsolidar.statusCode).toBe(200);
    expect(resConsolidar.json().consolidadas).toBe(1);

    const insumoAposConsolidar = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } });
    expect(insumoAposConsolidar.estoqueAtual).toBe(9);
  });
});
