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
    expect((padrao as any).categoria).toBe('INGREDIENTE');

    const embalagem = await prisma.insumo.create({
      data: { nome: 'Saco Teste', unidade: 'Unidade', categoria: 'EMBALAGEM' } as any,
    });
    expect((embalagem as any).categoria).toBe('EMBALAGEM');

    const bebida = await prisma.insumo.create({
      data: { nome: 'Coca Teste', unidade: 'Unidade', categoria: 'BEBIDA' } as any,
    });
    expect((bebida as any).categoria).toBe('BEBIDA');
  });

  it('rejeita valor desconhecido no enum CategoriaInsumo', async () => {
    await expect(
      prisma.insumo.create({
        data: { nome: 'Invalido', unidade: 'Unidade', categoria: 'SOBREMESA' } as any,
      }),
    ).rejects.toThrow();
  });
});
