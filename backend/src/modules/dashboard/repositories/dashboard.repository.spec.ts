import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import { DashboardRepository } from './dashboard.repository.js';

async function limparVendas() {
  await prisma.venda.deleteMany().catch(() => {});
}

describe('DashboardRepository', () => {
  const repo = new DashboardRepository();

  beforeEach(limparVendas);

  afterAll(async () => {
    await limparVendas();
    await prisma.$disconnect().catch(() => {});
  });

  it('buscarVendasProcessadasPorPeriodo exclui no SQL vendas com _estorno preenchido e mantém ativas, _estorno null e não-objeto', async () => {
    const agora = new Date();
    const inicio = new Date(agora.getTime() - 60_000);
    const fim = new Date(agora.getTime() + 60_000);

    const vAtiva = await prisma.venda.create({
      data: {
        externalId: 'manual:repo-ativa',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { info: { id: 'manual:repo-ativa', check: 1, items: [] } },
      },
    });
    const vEstornada = await prisma.venda.create({
      data: {
        externalId: 'manual:repo-estornada',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: {
          info: { id: 'manual:repo-estornada', check: 1, items: [] },
          _estorno: { usuarioId: 'u1', em: agora.toISOString(), motivo: 'Erro' },
        },
      },
    });
    const vEstornoNull = await prisma.venda.create({
      data: {
        externalId: 'manual:repo-estorno-null',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: {
          info: { id: 'manual:repo-estorno-null', check: 1, items: [] },
          _estorno: null,
        },
      },
    });
    const vNaoObjeto = await prisma.venda.create({
      data: {
        externalId: 'hook:repo-nao-objeto',
        origem: 'WEBHOOK',
        processado: true,
        payloadOriginal: 'payload-texto',
      },
    });
    await prisma.venda.create({
      data: {
        externalId: 'hook:repo-pendente',
        origem: 'WEBHOOK',
        processado: false,
        payloadOriginal: { info: { id: 'hook:repo-pendente', check: 1, items: [] } },
      },
    });

    const resultado = await repo.buscarVendasProcessadasPorPeriodo(inicio, fim);

    expect(resultado.map((v) => v.id)).not.toContain(vEstornada.id);
    expect(new Set(resultado.map((v) => v.id))).toEqual(
      new Set([vAtiva.id, vEstornoNull.id, vNaoObjeto.id]),
    );
    expect(resultado[0]!.criadoEm).toBeInstanceOf(Date);
  });

  it('filtra vendas processadas por ocorridoEm (não criadoEm) e devolve origem', async () => {
    const agora = new Date();
    const haTresDias = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000);
    const inicioHoje = new Date(agora.getTime() - 60_000);
    const fimHoje = new Date(agora.getTime() + 60_000);
    const inicioHaTresDias = new Date(haTresDias.getTime() - 60_000);
    const fimHaTresDias = new Date(haTresDias.getTime() + 60_000);

    // Venda lançada agora (criadoEm = hoje), mas ocorrida há 3 dias
    const vendaRetroativa = await prisma.venda.create({
      data: {
        externalId: 'manual:retro-3-dias',
        origem: 'MANUAL',
        ocorridoEm: haTresDias,
        processado: true,
        payloadOriginal: { info: { id: 'manual:retro-3-dias', check: 1, items: [] } },
      },
    });

    const deHoje = await repo.buscarVendasProcessadasPorPeriodo(inicioHoje, fimHoje);
    expect(deHoje.map((v) => v.id)).not.toContain(vendaRetroativa.id);

    const deTresDiasAtras = await repo.buscarVendasProcessadasPorPeriodo(inicioHaTresDias, fimHaTresDias);
    expect(deTresDiasAtras).toHaveLength(1);
    expect(deTresDiasAtras[0]).toMatchObject({
      id: vendaRetroativa.id,
      origem: 'MANUAL',
    });
    expect(deTresDiasAtras[0]!.ocorridoEm).toBeInstanceOf(Date);
  });
});
