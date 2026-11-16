import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { EstornarFechamentoService } from '../../modules/vendas/services/estornar_fechamento.service.js';
import { FechamentoManualService } from '../../modules/vendas/services/fechamento_manual.service.js';

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

describe('Estorno do Fechamento Manual HTTP API (POST /api/vendas/:id/estornar)', () => {
  let auth: Record<string, string>;
  const usuarioId = 'user-estorno-http';
  const fechamentoService = new FechamentoManualService();

  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: usuarioId },
      update: { ativo: true, tokenVersion: 0, nome: 'Carlos Estorno' },
      create: {
        id: usuarioId,
        nome: 'Carlos Estorno',
        email: 'estorno.http@teste.com',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
    const token = app.jwt.sign({
      sub: usuarioId,
      email: 'estorno.http@teste.com',
      role: 'ADMIN',
      tv: 0,
    });
    auth = { authorization: `Bearer ${token}` };
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: usuarioId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('retorna 401 sem JWT e 400 para ID inválido, motivo vazio ou maior que 500 caracteres', async () => {
    const semToken = await app.inject({
      method: 'POST',
      url: `/api/vendas/${randomUUID()}/estornar`,
      payload: { motivo: 'Erro' },
    });
    expect(semToken.statusCode).toBe(401);

    const idInvalido = await app.inject({
      method: 'POST',
      url: '/api/vendas/nao-eh-uuid/estornar',
      headers: auth,
      payload: { motivo: 'Erro' },
    });
    expect(idInvalido.statusCode).toBe(400);
    expect(idInvalido.json().issues[0].message).toBe('ID de venda inválido');

    const motivoVazio = await app.inject({
      method: 'POST',
      url: `/api/vendas/${randomUUID()}/estornar`,
      headers: auth,
      payload: { motivo: '   ' },
    });
    expect(motivoVazio.statusCode).toBe(400);
    expect(motivoVazio.json().issues[0].message).toBe('Informe o motivo do estorno');

    const motivoLongo = await app.inject({
      method: 'POST',
      url: `/api/vendas/${randomUUID()}/estornar`,
      headers: auth,
      payload: { motivo: 'a'.repeat(501) },
    });
    expect(motivoLongo.statusCode).toBe(400);
    expect(motivoLongo.json().issues[0].message).toBe('O motivo deve ter no máximo 500 caracteres');
  });

  it('retorna 404 para venda inexistente, 400 para WEBHOOK e 422 para MANUAL sem snapshot', async () => {
    const r404 = await app.inject({
      method: 'POST',
      url: `/api/vendas/${randomUUID()}/estornar`,
      headers: auth,
      payload: { motivo: 'Não existe' },
    });
    expect(r404.statusCode).toBe(404);

    const webhook = await prisma.venda.create({
      data: {
        externalId: 'hook-http-01',
        origem: 'WEBHOOK',
        processado: true,
        payloadOriginal: { check: 1, items: [] },
      },
    });
    const r400 = await app.inject({
      method: 'POST',
      url: `/api/vendas/${webhook.id}/estornar`,
      headers: auth,
      payload: { motivo: 'Webhook' },
    });
    expect(r400.statusCode).toBe(400);
    expect(r400.json().message).toBe('Só é possível estornar fechamentos manuais');

    const legado = await prisma.venda.create({
      data: {
        externalId: 'manual:legado-http',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { origem: 'manual' },
      },
    });
    const r422 = await app.inject({
      method: 'POST',
      url: `/api/vendas/${legado.id}/estornar`,
      headers: auth,
      payload: { motivo: 'Sem snapshot' },
    });
    expect(r422.statusCode).toBe(422);
  });

  it('estorna 2 BACON HOUSE devolvendo snapshot com usuarioId do JWT, aceita 500 chars e rejeita 2º estorno com 409', async () => {
    const carne = await prisma.insumo.create({
      data: { nome: 'Carne de Hambúrguer', unidade: 'Gramas', fatorPerda: 0.05, estoqueAtual: 1400 },
    });
    const bacon = await prisma.insumo.create({
      data: { nome: 'Bacon Fatiado', unidade: 'Gramas', estoqueAtual: 500 },
    });
    const burger = await prisma.produto.create({
      data: {
        nome: 'BACON HOUSE',
        fichasTecnicas: {
          create: [
            { insumoId: carne.id, quantidade: 150 }, // 150 * 1.05 * 2 = 315
            { insumoId: bacon.id, quantidade: 40 }, // 40 * 2 = 80
          ],
        },
      },
    });

    const fechado = await fechamentoService.confirmar({
      chaveIdempotencia: 'http-estorno-bacon-01',
      data: '2026-11-13',
      itens: [{ produtoId: burger.id, quantidade: 2 }],
      usuarioId,
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1085);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: bacon.id } })).estoqueAtual).toBe(420);

    const motivo500 = 'm'.repeat(500);
    const res = await app.inject({
      method: 'POST',
      url: `/api/vendas/${fechado.vendaId}/estornar`,
      headers: auth,
      payload: { motivo: `  ${motivo500}  ` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      vendaId: fechado.vendaId,
      estornada: true,
      estorno: {
        usuarioId,
        em: expect.any(String),
        motivo: motivo500,
      },
      devolucoes: expect.arrayContaining([
        {
          insumoId: carne.id,
          nome: 'Carne de Hambúrguer',
          unidade: 'Gramas',
          quantidade: 315,
          estoqueAtual: 1400,
        },
        {
          insumoId: bacon.id,
          nome: 'Bacon Fatiado',
          unidade: 'Gramas',
          quantidade: 80,
          estoqueAtual: 500,
        },
      ]),
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1400);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: bacon.id } })).estoqueAtual).toBe(500);

    // 2º estorno -> 409 e saldos intactos
    const segundo = await app.inject({
      method: 'POST',
      url: `/api/vendas/${fechado.vendaId}/estornar`,
      headers: auth,
      payload: { motivo: 'Repetido' },
    });
    expect(segundo.statusCode).toBe(409);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1400);
  });

  it('concorrência real (Promise.all): duas chamadas simultâneas devolvem o estoque uma única vez (200 e 409)', async () => {
    const carne = await prisma.insumo.create({
      data: { nome: 'Carne Concorrência', unidade: 'Gramas', estoqueAtual: 500 },
    });
    const burger = await prisma.produto.create({
      data: {
        nome: 'Burger Concorrência',
        fichasTecnicas: { create: [{ insumoId: carne.id, quantidade: 200 }] },
      },
    });
    const fechado = await fechamentoService.confirmar({
      chaveIdempotencia: 'http-estorno-conc-01',
      data: '2026-11-13',
      itens: [{ produtoId: burger.id, quantidade: 1 }],
      usuarioId,
    });
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(300);

    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/vendas/${fechado.vendaId}/estornar`,
        headers: auth,
        payload: { motivo: 'Concorrência 1' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/vendas/${fechado.vendaId}/estornar`,
        headers: auth,
        payload: { motivo: 'Concorrência 2' },
      }),
    ]);

    const codigos = [r1.statusCode, r2.statusCode].sort();
    expect(codigos).toEqual([200, 409]);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(500);
  });

  it('retorna 500 genérico quando ocorre falha inesperada no serviço', async () => {
    const spy = vi
      .spyOn(EstornarFechamentoService.prototype, 'executar')
      .mockRejectedValueOnce(new Error('Falha interna inesperada'));

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/vendas/${randomUUID()}/estornar`,
        headers: auth,
        payload: { motivo: 'Teste erro 500' },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: 'Erro interno no servidor' });
    } finally {
      spy.mockRestore();
    }
  });
});
