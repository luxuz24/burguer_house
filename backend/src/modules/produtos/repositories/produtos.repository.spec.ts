import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ProdutosRepository } from './produtos.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('ProdutosRepository (banco de testes)', () => {
  const repository = new ProdutosRepository();

  beforeEach(async () => {
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.produto.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.produto.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('deve criar um produto com sucesso', async () => {
    const produto = await repository.criar({ nome: 'X-Bacon Especial' });

    expect(produto).toBeDefined();
    expect(produto.id).toBeTypeOf('string');
    expect(produto.nome).toBe('X-Bacon Especial');
  });

  it('deve listar todos os produtos ordenados alfabeticamente por nome', async () => {
    await repository.criar({ nome: 'X-Salada' });
    await repository.criar({ nome: 'Cheeseburger' });
    await repository.criar({ nome: 'X-Bacon' });

    const lista = await repository.listarTodos();
    expect(lista.length).toBe(3);
    expect(lista[0]?.nome).toBe('Cheeseburger');
    expect(lista[1]?.nome).toBe('X-Bacon');
    expect(lista[2]?.nome).toBe('X-Salada');
  });

  it('deve buscar produto por ID com suas fichas tecnicas ordenadas pelo nome do insumo', async () => {
    const produto = await repository.criar({ nome: 'X-Burger' });
    const queijo = await prisma.insumo.create({
      data: { nome: 'Queijo Prato', unidade: 'Unidade', estoqueAtual: 10, estoqueMinimo: 2, fatorPerda: 0 },
    });
    const carne = await prisma.insumo.create({
      data: { nome: 'Carne Bovina', unidade: 'Gramas', estoqueAtual: 1000, estoqueMinimo: 100, fatorPerda: 0 },
    });
    const alface = await prisma.insumo.create({
      data: { nome: 'Alface Americana', unidade: 'Gramas', estoqueAtual: 500, estoqueMinimo: 50, fatorPerda: 0 },
    });

    await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: queijo.id, quantidade: 2 } });
    await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: carne.id, quantidade: 160 } });
    await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: alface.id, quantidade: 30 } });

    const encontrado = await repository.buscarPorId(produto.id);
    expect(encontrado).not.toBeNull();
    expect(encontrado?.nome).toBe('X-Burger');
    expect(encontrado?.fichasTecnicas.length).toBe(3);
    expect(encontrado?.fichasTecnicas[0]?.insumo.nome).toBe('Alface Americana');
    expect(encontrado?.fichasTecnicas[1]?.insumo.nome).toBe('Carne Bovina');
    expect(encontrado?.fichasTecnicas[2]?.insumo.nome).toBe('Queijo Prato');
  });

  it('deve retornar null ao buscar por ID inexistente', async () => {
    const res = await repository.buscarPorId('00000000-0000-0000-0000-000000000000');
    expect(res).toBeNull();
  });

  it('deve atualizar o nome de um produto existente', async () => {
    const produto = await repository.criar({ nome: 'X-Tudo' });
    const atualizado = await repository.atualizar(produto.id, { nome: 'X-Tudo Mega' });

    expect(atualizado.nome).toBe('X-Tudo Mega');

    const conferido = await repository.buscarPorId(produto.id);
    expect(conferido?.nome).toBe('X-Tudo Mega');
  });

  it('deve deletar um produto existente e remover suas fichas tecnicas em cascata', async () => {
    const produto = await repository.criar({ nome: 'X-Excluir' });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Molho Barbecue', unidade: 'Gramas', estoqueAtual: 200, estoqueMinimo: 20, fatorPerda: 0 },
    });
    await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 20 } });

    await repository.deletar(produto.id);

    const posExclusao = await repository.buscarPorId(produto.id);
    expect(posExclusao).toBeNull();

    const fichasRestantes = await prisma.fichaTecnica.count({ where: { produtoId: produto.id } });
    expect(fichasRestantes).toBe(0);

    const insumoContinuaExistindo = await prisma.insumo.findUnique({ where: { id: insumo.id } });
    expect(insumoContinuaExistindo).not.toBeNull();
  });
});
