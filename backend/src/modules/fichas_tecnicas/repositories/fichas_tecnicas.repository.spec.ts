import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  FichasTecnicasRepository,
  ProdutoNaoEncontradoError,
  InsumoNaoEncontradoError,
  ItemFichaJaExisteError,
} from './fichas_tecnicas.repository.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('FichasTecnicasRepository (banco de testes)', () => {
  const repository = new FichasTecnicasRepository();

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

  it('deve criar um item na ficha tecnica e retornar com os dados do insumo', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'Smash Burger' } });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Pao Brioche', unidade: 'Unidade', estoqueAtual: 50, estoqueMinimo: 10, fatorPerda: 0 },
    });

    const item = await repository.criar({
      produtoId: produto.id,
      insumoId: insumo.id,
      quantidade: 1,
    });

    expect(item).toBeDefined();
    expect(item.id).toBeTypeOf('string');
    expect(item.quantidade).toBe(1);
    expect(item.insumo).toBeDefined();
    expect(item.insumo.nome).toBe('Pao Brioche');
  });

  it('deve lancar ProdutoNaoEncontradoError ao tentar criar para produto inexistente', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Bacon Fatiado', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10, fatorPerda: 0 },
    });

    await expect(
      repository.criar({
        produtoId: '00000000-0000-0000-0000-000000000000',
        insumoId: insumo.id,
        quantidade: 30,
      }),
    ).rejects.toThrow(ProdutoNaoEncontradoError);
  });

  it('deve lancar InsumoNaoEncontradoError ao tentar criar com insumo inexistente', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'X-Bacon' } });

    await expect(
      repository.criar({
        produtoId: produto.id,
        insumoId: '00000000-0000-0000-0000-000000000000',
        quantidade: 30,
      }),
    ).rejects.toThrow(InsumoNaoEncontradoError);
  });

  it('deve lancar ItemFichaJaExisteError ao tentar vincular o mesmo insumo duas vezes no mesmo produto', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'Double Burger' } });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Carne Smash', unidade: 'Gramas', estoqueAtual: 500, estoqueMinimo: 50, fatorPerda: 0 },
    });

    await repository.criar({ produtoId: produto.id, insumoId: insumo.id, quantidade: 90 });

    await expect(
      repository.criar({ produtoId: produto.id, insumoId: insumo.id, quantidade: 90 }),
    ).rejects.toThrow(ItemFichaJaExisteError);
  });

  it('deve buscar item por id com os dados do insumo ou retornar null se nao existir', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'X-Egg' } });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Ovo', unidade: 'Unidade', estoqueAtual: 30, estoqueMinimo: 5, fatorPerda: 0 },
    });

    const item = await repository.criar({ produtoId: produto.id, insumoId: insumo.id, quantidade: 1 });

    const achado = await repository.buscarPorId(item.id);
    expect(achado).not.toBeNull();
    expect(achado?.insumo.nome).toBe('Ovo');

    const inexistente = await repository.buscarPorId('00000000-0000-0000-0000-000000000000');
    expect(inexistente).toBeNull();
  });

  it('deve atualizar a quantidade de um item na ficha tecnica e retornar com insumo', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'X-Calabresa' } });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Calabresa Fatiada', unidade: 'Gramas', estoqueAtual: 200, estoqueMinimo: 20, fatorPerda: 0 },
    });
    const item = await repository.criar({ produtoId: produto.id, insumoId: insumo.id, quantidade: 50 });

    const atualizado = await repository.atualizar(item.id, { quantidade: 80 });
    expect(atualizado.quantidade).toBe(80);
    expect(atualizado.insumo.nome).toBe('Calabresa Fatiada');
  });

  it('deve listar as fichas tecnicas por produto em ordem alfabetica de insumo', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'Super Smash' } });
    const insumoZ = await prisma.insumo.create({
      data: { nome: 'Zucchini Grelhado', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10, fatorPerda: 0 },
    });
    const insumoA = await prisma.insumo.create({
      data: { nome: 'Alho Poró', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10, fatorPerda: 0 },
    });
    const insumoC = await prisma.insumo.create({
      data: { nome: 'Cebola Roxa', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10, fatorPerda: 0 },
    });

    await repository.criar({ produtoId: produto.id, insumoId: insumoZ.id, quantidade: 20 });
    await repository.criar({ produtoId: produto.id, insumoId: insumoA.id, quantidade: 15 });
    await repository.criar({ produtoId: produto.id, insumoId: insumoC.id, quantidade: 30 });

    const lista = await repository.listarPorProduto(produto.id);
    expect(lista.length).toBe(3);
    expect(lista[0]?.insumo.nome).toBe('Alho Poró');
    expect(lista[1]?.insumo.nome).toBe('Cebola Roxa');
    expect(lista[2]?.insumo.nome).toBe('Zucchini Grelhado');
  });

  it('deve lancar ProdutoNaoEncontradoError ao listar fichas de produto inexistente', async () => {
    await expect(repository.listarPorProduto('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      ProdutoNaoEncontradoError,
    );
  });

  it('deve deletar um item da ficha tecnica', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'X-Simples' } });
    const insumo = await prisma.insumo.create({
      data: { nome: 'Maionese', unidade: 'Gramas', estoqueAtual: 100, estoqueMinimo: 10, fatorPerda: 0 },
    });
    const item = await repository.criar({ produtoId: produto.id, insumoId: insumo.id, quantidade: 20 });

    await repository.deletar(item.id);

    const posExclusao = await repository.buscarPorId(item.id);
    expect(posExclusao).toBeNull();
  });

  it('deve converter P2003 em InsumoNaoEncontradoError quando insumo violar chave estrangeira (formato adapter-pg)', async () => {
    const fakePrisma = {
      produto: { findUnique: async () => ({ id: 'prod-1' }) },
      insumo: { findUnique: async () => ({ id: 'ins-1' }) },
      fichaTecnica: {
        create: async () => {
          const err = new Error('Foreign key violation') as Error & {
            code?: string;
            meta?: {
              modelName?: string;
              driverAdapterError?: {
                cause?: {
                  constraint?: {
                    index?: string;
                  };
                };
              };
            };
          };
          err.code = 'P2003';
          err.meta = {
            modelName: 'FichaTecnica',
            driverAdapterError: {
              cause: {
                constraint: {
                  index: 'fichas_tecnicas_insumoId_fkey',
                },
              },
            },
          };
          throw err;
        },
      },
    };

    const customRepo = new FichasTecnicasRepository(fakePrisma as unknown as typeof prisma);
    await expect(
      customRepo.criar({ produtoId: 'prod-1', insumoId: 'ins-1', quantidade: 1 }),
    ).rejects.toThrow(InsumoNaoEncontradoError);
  });

  it('deve converter P2003 em ProdutoNaoEncontradoError quando produto violar chave estrangeira (formato adapter-pg)', async () => {
    const fakePrisma = {
      produto: { findUnique: async () => ({ id: 'prod-1' }) },
      insumo: { findUnique: async () => ({ id: 'ins-1' }) },
      fichaTecnica: {
        create: async () => {
          const err = new Error('Foreign key violation') as Error & {
            code?: string;
            meta?: {
              modelName?: string;
              driverAdapterError?: {
                constraint?: {
                  index?: string;
                };
              };
            };
          };
          err.code = 'P2003';
          err.meta = {
            modelName: 'FichaTecnica',
            driverAdapterError: {
              constraint: {
                index: 'fichas_tecnicas_produtoId_fkey',
              },
            },
          };
          throw err;
        },
      },
    };

    const customRepo = new FichasTecnicasRepository(fakePrisma as unknown as typeof prisma);
    await expect(
      customRepo.criar({ produtoId: 'prod-1', insumoId: 'ins-1', quantidade: 1 }),
    ).rejects.toThrow(ProdutoNaoEncontradoError);
  });

  it('deve relancar erro P2003 nao reconhecido sem converter silenciosamente em ProdutoNaoEncontradoError', async () => {
    const fakePrisma = {
      produto: { findUnique: async () => ({ id: 'prod-1' }) },
      insumo: { findUnique: async () => ({ id: 'ins-1' }) },
      fichaTecnica: {
        create: async () => {
          const err = new Error('Foreign key violation on other entity') as Error & {
            code?: string;
            meta?: {
              driverAdapterError?: {
                constraint?: {
                  index?: string;
                };
              };
            };
          };
          err.code = 'P2003';
          err.meta = {
            driverAdapterError: {
              constraint: {
                index: 'outra_tabela_estrangeira_fkey',
              },
            },
          };
          throw err;
        },
      },
    };

    const customRepo = new FichasTecnicasRepository(fakePrisma as unknown as typeof prisma);
    await expect(
      customRepo.criar({ produtoId: 'prod-1', insumoId: 'ins-1', quantidade: 1 }),
    ).rejects.toThrow('Foreign key violation on other entity');
  });

  it('deve relancar P2003 com meta vazio sem converter em ProdutoNaoEncontradoError', async () => {
    const fakePrisma = {
      produto: { findUnique: async () => ({ id: 'prod-1' }) },
      insumo: { findUnique: async () => ({ id: 'ins-1' }) },
      fichaTecnica: {
        create: async () => {
          const err = new Error('Foreign key violation without meta') as Error & {
            code?: string;
            meta?: Record<string, unknown>;
          };
          err.code = 'P2003';
          err.meta = {};
          throw err;
        },
      },
    };

    const customRepo = new FichasTecnicasRepository(fakePrisma as unknown as typeof prisma);
    await expect(
      customRepo.criar({ produtoId: 'prod-1', insumoId: 'ins-1', quantidade: 1 }),
    ).rejects.toThrow('Foreign key violation without meta');
  });

  it('deve converter P2003 em InsumoNaoEncontradoError em corrida real simulada contra o banco de teste', async () => {
    const produto = await prisma.produto.create({ data: { nome: 'X-Race-Simulado' } });
    const raceRepo = new FichasTecnicasRepository({
      ...prisma,
      insumo: {
        ...prisma.insumo,
        findUnique: async () => ({ id: '00000000-0000-0000-0000-000000000099' }),
      },
    } as unknown as typeof prisma);

    await expect(
      raceRepo.criar({
        produtoId: produto.id,
        insumoId: '00000000-0000-0000-0000-000000000099',
        quantidade: 10,
      }),
    ).rejects.toThrow(InsumoNaoEncontradoError);
  });
});
