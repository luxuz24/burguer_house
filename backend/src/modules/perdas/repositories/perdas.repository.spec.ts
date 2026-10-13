import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PerdasRepository, InsumoNaoEncontradoError } from './perdas.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('PerdasRepository', () => {
  const repository = new PerdasRepository();

  beforeEach(async () => {
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve registrar uma perda e abater do estoque com sucesso', async () => {
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Tomate Teste Perda',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
      },
    });

    const perda = await repository.registrar({
      insumoId: insumo.id,
      quantidade: 50,
      motivo: 'ESTRAGADO',
    });

    expect(perda).toBeDefined();
    expect(perda.id).toBeTypeOf('string');
    expect(perda.quantidade).toBe(50);
    expect(perda.motivo).toBe('ESTRAGADO');
    expect(perda.insumo.nome).toBe('Tomate Teste Perda');

    const insumoAtualizado = await prisma.insumo.findUnique({
      where: { id: insumo.id },
    });
    expect(insumoAtualizado?.estoqueAtual).toBe(450);
  });

  it('deve lançar InsumoNaoEncontradoError se o insumo não existir', async () => {
    await expect(
      repository.registrar({
        insumoId: '00000000-0000-0000-0000-000000000000',
        quantidade: 10,
        motivo: 'VENCIMENTO',
      })
    ).rejects.toThrow(InsumoNaoEncontradoError);
  });

  it('deve listar perdas recentes ordenadas por data de criação descrescente', async () => {
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Pão Teste Perda',
        unidade: 'Unidade',
        fatorPerda: 0,
        estoqueAtual: 100,
        estoqueMinimo: 10,
      },
    });

    await repository.registrar({
      insumoId: insumo.id,
      quantidade: 2,
      motivo: 'ERRO_PREPARO',
    });

    await repository.registrar({
      insumoId: insumo.id,
      quantidade: 5,
      motivo: 'VENCIMENTO',
    });

    const recentes = await repository.listarRecentes(10);
    expect(recentes.length).toBe(2);
    expect(recentes[0]?.motivo).toBe('VENCIMENTO');
    expect(recentes[1]?.motivo).toBe('ERRO_PREPARO');
  });

  it('deve calcular o resumo mensal de perdas agrupadas por motivo', async () => {
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Carne Teste Resumo',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 1000,
        estoqueMinimo: 100,
      },
    });

    await repository.registrar({
      insumoId: insumo.id,
      quantidade: 150,
      motivo: 'VENCIMENTO',
    });

    await repository.registrar({
      insumoId: insumo.id,
      quantidade: 50,
      motivo: 'VENCIMENTO',
    });

    await repository.registrar({
      insumoId: insumo.id,
      quantidade: 80,
      motivo: 'ESTRAGADO',
    });

    const hoje = new Date();
    const resumo = await repository.resumoMensal(
      hoje.getUTCFullYear(),
      hoje.getUTCMonth() + 1
    );

    expect(resumo.length).toBe(2);

    const vencimento = resumo.find((r) => r.motivo === 'VENCIMENTO');
    expect(vencimento).toBeDefined();
    expect(vencimento?.quantidadeTotal).toBe(200);
    expect(vencimento?.ocorrencias).toBe(2);

    const estragado = resumo.find((r) => r.motivo === 'ESTRAGADO');
    expect(estragado).toBeDefined();
    expect(estragado?.quantidadeTotal).toBe(80);
    expect(estragado?.ocorrencias).toBe(1);
  });
});
