import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { VendasRepository } from './vendas.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('VendasRepository.salvar (eventos de um mesmo pedido)', () => {
  const repo = new VendasRepository();

  beforeEach(async () => {
    await prisma.venda.deleteMany().catch(() => {});
  });
  afterAll(async () => {
    await prisma.venda.deleteMany().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('cria a venda no primeiro evento do pedido', async () => {
    const r = await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 1 } });
    expect(r).toMatchObject({ duplicada: false, atualizada: false });
    expect(await prisma.venda.count()).toBe(1);
  });

  it('reenvio idêntico não duplica nem altera', async () => {
    await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 1 } });
    const r = await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 1 } });
    expect(r).toMatchObject({ duplicada: true, atualizada: false });
    expect(await prisma.venda.count()).toBe(1);
  });

  it('novo estado do pedido ainda pendente substitui o payload (vale o último evento)', async () => {
    await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 1 } });
    const r = await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 4 } });

    expect(r).toMatchObject({ duplicada: true, atualizada: true });
    const venda = await prisma.venda.findUniqueOrThrow({ where: { externalId: 'p1' } });
    expect((venda.payloadOriginal as { check: number }).check).toBe(4);
    expect(await prisma.venda.count()).toBe(1);
  });

  it('venda já consolidada não é reescrita (o estoque já foi abatido)', async () => {
    await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 1 } });
    await prisma.venda.update({ where: { externalId: 'p1' }, data: { processado: true } });

    const r = await repo.salvar({ externalId: 'p1', payloadOriginal: { id: 'p1', check: 4 } });

    expect(r).toMatchObject({ duplicada: true, atualizada: false });
    const venda = await prisma.venda.findUniqueOrThrow({ where: { externalId: 'p1' } });
    expect((venda.payloadOriginal as { check: number }).check).toBe(1);
  });

  it('sem identificador cada evento vira uma venda (não há como deduplicar)', async () => {
    await repo.salvar({ payloadOriginal: { items: [] } });
    await repo.salvar({ payloadOriginal: { items: [] } });
    expect(await prisma.venda.count()).toBe(2);
  });
});
