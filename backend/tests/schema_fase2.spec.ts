import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/infra/database/prisma.js';

async function limparBancoTeste() {
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.notaFiscal.deleteMany().catch(() => {});
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
  await prisma.usuario.deleteMany().catch(() => {});
}

describe('Fase 2 Schema — 2.1 CategoriaInsumo', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa INGREDIENTE como categoria padrão e aceita EMBALAGEM e BEBIDA', async () => {
    const padrao = await prisma.insumo.create({
      data: { nome: 'Cebola Teste', unidade: 'Gramas' },
    });
    expect(padrao.categoria).toBe('INGREDIENTE');

    const embalagem = await prisma.insumo.create({
      data: { nome: 'Saco Teste', unidade: 'Unidade', categoria: 'EMBALAGEM' },
    });
    expect(embalagem.categoria).toBe('EMBALAGEM');

    const bebida = await prisma.insumo.create({
      data: { nome: 'Coca Teste', unidade: 'Unidade', categoria: 'BEBIDA' },
    });
    expect(bebida.categoria).toBe('BEBIDA');
  });

  it('rejeita valor desconhecido no enum CategoriaInsumo', async () => {
    await expect(
      prisma.insumo.create({
        data: { nome: 'Invalido', unidade: 'Unidade', categoria: 'SOBREMESA' } as any,
      }),
    ).rejects.toThrow();
  });
});

describe('Fase 2 Schema — 2.2 Venda (origem, ocorridoEm, registradoPorId)', () => {
  beforeEach(async () => {
    await limparBancoTeste();
  });

  afterAll(async () => {
    await limparBancoTeste();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa WEBHOOK e ocorridoEm padrão, aceita registradoPorId nulo e vira nulo se usuário for apagado', async () => {
    const vendaWebhook = await prisma.venda.create({
      data: { externalId: 'v-wh-1', payloadOriginal: { check: 1 } },
    });
    expect((vendaWebhook as any).origem).toBe('WEBHOOK');
    expect((vendaWebhook as any).ocorridoEm).toBeInstanceOf(Date);
    expect((vendaWebhook as any).registradoPorId).toBeNull();

    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Gerente Manual',
        email: 'manual@fase2.test',
        senha: 'hash',
        role: 'GERENTE',
      },
    });

    const dataPassada = new Date('2026-11-10T22:00:00.000Z');
    const vendaManual = await prisma.venda.create({
      data: {
        externalId: 'manual-chave-1',
        payloadOriginal: { check: 1, info: { items: [] } },
        origem: 'MANUAL',
        registradoPorId: usuario.id,
        ocorridoEm: dataPassada,
      } as any,
    });
    expect((vendaManual as any).origem).toBe('MANUAL');
    expect((vendaManual as any).registradoPorId).toBe(usuario.id);
    expect((vendaManual as any).ocorridoEm).toEqual(dataPassada);

    await prisma.usuario.delete({ where: { id: usuario.id } });

    const vendaAposDelete = await prisma.venda.findUniqueOrThrow({ where: { id: vendaManual.id } });
    expect((vendaAposDelete as any).registradoPorId).toBeNull();
  });

  it('rejeita origem desconhecida no enum OrigemVenda', async () => {
    await expect(
      prisma.venda.create({
        data: { externalId: 'v-err', payloadOriginal: {}, origem: 'IFOOD' } as any,
      }),
    ).rejects.toThrow();
  });
});
