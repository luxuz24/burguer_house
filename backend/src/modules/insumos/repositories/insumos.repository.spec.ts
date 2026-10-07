import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { InsumosRepository } from './insumos.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('InsumosRepository', () => {
  const repository = new InsumosRepository();

  beforeEach(async () => {
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve criar um novo insumo com sucesso', async () => {
    const novoInsumo = await repository.criar({
      nome: 'Queijo Cheddar Teste',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 500,
      estoqueMinimo: 100,
    });

    expect(novoInsumo).toBeDefined();
    expect(novoInsumo.id).toBeTypeOf('string');
    expect(novoInsumo.nome).toBe('Queijo Cheddar Teste');
    expect(novoInsumo.estoqueAtual).toBe(500);
  });

  it('deve listar todos os insumos ordenados por nome', async () => {
    await repository.criar({
      nome: 'Bacon Teste',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 200,
      estoqueMinimo: 50,
    });
    await repository.criar({
      nome: 'Alface Teste',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    });

    const lista = await repository.listarTodos();
    expect(lista.length).toBe(2);
    expect(lista[0]?.nome).toBe('Alface Teste');
    expect(lista[1]?.nome).toBe('Bacon Teste');
  });

  it('deve listar insumos em alerta quando estoqueAtual <= estoqueMinimo', async () => {
    await repository.criar({
      nome: 'Item Crítico',
      unidade: 'Unidade',
      fatorPerda: 0,
      estoqueAtual: 5,
      estoqueMinimo: 10,
    });
    await repository.criar({
      nome: 'Item OK',
      unidade: 'Unidade',
      fatorPerda: 0,
      estoqueAtual: 50,
      estoqueMinimo: 10,
    });

    const alertas = (await repository.listarAlertas()) as Array<{ nome: string }>;
    expect(alertas.length).toBe(1);
    expect(alertas[0]?.nome).toBe('Item Crítico');
  });

  it('deve atualizar os dados de um insumo', async () => {
    const insumo = await repository.criar({
      nome: 'Tomate Teste',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    });

    const atualizado = await repository.atualizar(insumo.id, {
      estoqueAtual: 150,
    });

    expect(atualizado.estoqueAtual).toBe(150);
  });

  it('deve deletar um insumo existente', async () => {
    const insumo = await repository.criar({
      nome: 'Cebola Teste',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    });

    await repository.deletar(insumo.id);

    const lista = await repository.listarTodos();
    expect(lista.find((i) => i.id === insumo.id)).toBeUndefined();
  });
});
