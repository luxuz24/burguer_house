import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { InsumosRepository, ConflitoUnidadeInsumoError } from './insumos.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('InsumosRepository', () => {
  const repository = new InsumosRepository();

  beforeEach(async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
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

  it('deve permitir alterar a unidade quando o insumo nao tem vinculos', async () => {
    const insumo = await repository.criar({
      nome: 'Queijo Solto',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    });

    const atualizado = await repository.atualizar(insumo.id, {
      unidade: 'Unidades',
    });

    expect(atualizado.unidade).toBe('Unidades');
  });

  it('deve lancar ConflitoUnidadeInsumoError ao tentar alterar a unidade de insumo com vinculo', async () => {
    const insumo = await repository.criar({
      nome: 'Pao de Hamburguer',
      unidade: 'Unidades',
      fatorPerda: 0,
      estoqueAtual: 100,
      estoqueMinimo: 20,
    });

    const produto = await prisma.produto.create({
      data: { nome: 'Hamburguer Classico' },
    });

    await prisma.fichaTecnica.create({
      data: {
        produtoId: produto.id,
        insumoId: insumo.id,
        quantidade: 1,
      },
    });

    await expect(
      repository.atualizar(insumo.id, {
        unidade: 'Gramas',
      }),
    ).rejects.toThrow(ConflitoUnidadeInsumoError);

    // Mas deve permitir alterar outros campos mantendo a mesma unidade
    const alterado = await repository.atualizar(insumo.id, {
      unidade: 'Unidades',
      nome: 'Pao de Hamburguer Brioche',
    });
    expect(alterado.nome).toBe('Pao de Hamburguer Brioche');
    expect(alterado.unidade).toBe('Unidades');
  });

  it('deve buscar um insumo por id ou retornar null se nao existir', async () => {
    const insumo = await repository.criar({
      nome: 'Queijo Prato',
      unidade: 'Unidade',
      fatorPerda: 0.05,
      estoqueAtual: 50,
      estoqueMinimo: 10,
      custoUnitario: 1.5,
      produzidoInternamente: false,
    });

    const encontrado = await repository.buscarPorId(insumo.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado?.nome).toBe('Queijo Prato');
    expect(encontrado?.custoUnitario).toBe(1.5);

    const inexistente = await repository.buscarPorId('00000000-0000-0000-0000-000000000000');
    expect(inexistente).toBeNull();
  });

  it('deve permitir atualizar validadeDias para null', async () => {
    const insumo = await repository.criar({
      nome: 'Molho Especial',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 200,
      estoqueMinimo: 50,
      produzidoInternamente: true,
      validadeDias: 5,
    });

    expect(insumo.validadeDias).toBe(5);

    const atualizado = await repository.atualizar(insumo.id, {
      validadeDias: null,
      produzidoInternamente: false,
    });

    expect(atualizado.validadeDias).toBeNull();
    expect(atualizado.produzidoInternamente).toBe(false);
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

  it('deve filtrar listarTodos por categoria e listar todas quando omitida', async () => {
    await repository.criar({
      nome: 'Carne Teste Cat',
      unidade: 'Gramas',
      fatorPerda: 0,
      estoqueAtual: 500,
      estoqueMinimo: 100,
    });
    await repository.criar({
      nome: 'Saco Kraft Teste Cat',
      unidade: 'Unidade',
      categoria: 'EMBALAGEM',
      fatorPerda: 0,
      estoqueAtual: 50,
      estoqueMinimo: 20,
    });
    await repository.criar({
      nome: 'Coca Zero Teste Cat',
      unidade: 'Unidade',
      categoria: 'BEBIDA',
      fatorPerda: 0,
      estoqueAtual: 30,
      estoqueMinimo: 12,
    });

    const todos = await repository.listarTodos();
    expect(todos.map((i) => i.categoria).sort()).toEqual(['BEBIDA', 'EMBALAGEM', 'INGREDIENTE']);

    const apenasEmbalagens = await repository.listarTodos('EMBALAGEM');
    expect(apenasEmbalagens.map((i) => i.nome)).toEqual(['Saco Kraft Teste Cat']);

    const apenasBebidas = await repository.listarTodos('BEBIDA');
    expect(apenasBebidas.map((i) => i.nome)).toEqual(['Coca Zero Teste Cat']);
  });
});
