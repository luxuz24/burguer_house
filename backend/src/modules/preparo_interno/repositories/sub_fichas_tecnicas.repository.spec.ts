import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SubFichasTecnicasRepository } from './sub_fichas_tecnicas.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('SubFichasTecnicasRepository', () => {
  const repository = new SubFichasTecnicasRepository();

  beforeEach(async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve vincular um insumo bruto a um insumo beneficiado com sucesso', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Maionese Teste SubFicha',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 100,
        produzidoInternamente: true,
      },
    });

    const bruto = await prisma.insumo.create({
      data: {
        nome: 'Óleo Teste SubFicha',
        unidade: 'Mililitros',
        fatorPerda: 0,
        estoqueAtual: 1000,
        estoqueMinimo: 200,
      },
    });

    const subFicha = await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto.id,
      quantidadeNecessaria: 0.64,
    });

    expect(subFicha).toBeDefined();
    expect(subFicha.id).toBeTypeOf('string');
    expect(subFicha.insumoBeneficiadoId).toBe(beneficiado.id);
    expect(subFicha.insumoBrutoId).toBe(bruto.id);
    expect(subFicha.quantidadeNecessaria).toBe(0.64);
    expect(subFicha.insumoBruto.nome).toBe('Óleo Teste SubFicha');
  });

  it('deve atualizar a quantidade necessária ao vincular o mesmo par novamente (upsert)', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Molho Especial Teste',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 50,
        produzidoInternamente: true,
      },
    });

    const bruto = await prisma.insumo.create({
      data: {
        nome: 'Mostarda Teste',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 50,
      },
    });

    await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto.id,
      quantidadeNecessaria: 0.2,
    });

    const atualizado = await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto.id,
      quantidadeNecessaria: 0.35,
    });

    expect(atualizado.quantidadeNecessaria).toBe(0.35);

    const lista = await repository.listarPorBeneficiado(beneficiado.id);
    expect(lista.length).toBe(1);
    expect(lista[0]?.quantidadeNecessaria).toBe(0.35);
  });

  it('deve listar ingredientes da sub-ficha do beneficiado', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Maionese Alho',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 100,
        produzidoInternamente: true,
      },
    });

    const bruto1 = await prisma.insumo.create({
      data: {
        nome: 'Óleo',
        unidade: 'Mililitros',
        fatorPerda: 0,
        estoqueAtual: 1000,
        estoqueMinimo: 200,
      },
    });

    const bruto2 = await prisma.insumo.create({
      data: {
        nome: 'Alho',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
      },
    });

    await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto1.id,
      quantidadeNecessaria: 0.5,
    });

    await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto2.id,
      quantidadeNecessaria: 0.05,
    });

    const itens = await repository.listarPorBeneficiado(beneficiado.id);
    expect(itens.length).toBe(2);
  });

  it('deve remover um ingrediente da sub-ficha com sucesso', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Beneficiado Remove Teste',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 50,
        produzidoInternamente: true,
      },
    });

    const bruto = await prisma.insumo.create({
      data: {
        nome: 'Bruto Remove Teste',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 50,
      },
    });

    const item = await repository.vincular({
      insumoBeneficiadoId: beneficiado.id,
      insumoBrutoId: bruto.id,
      quantidadeNecessaria: 0.1,
    });

    await repository.remover(item.id);

    const itens = await repository.listarPorBeneficiado(beneficiado.id);
    expect(itens.length).toBe(0);
  });
});
