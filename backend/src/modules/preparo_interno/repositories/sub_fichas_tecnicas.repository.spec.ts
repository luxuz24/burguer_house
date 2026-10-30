import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  SubFichasTecnicasRepository,
  SubFichaNaoEncontradaError,
  InsumoBeneficiadoNaoEncontradoError,
  InsumoBrutoNaoEncontradoError,
  InsumoNaoBeneficiadoError,
} from './sub_fichas_tecnicas.repository.js';
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

  it('deve lançar SubFichaNaoEncontradaError ao tentar remover id inexistente (P2025)', async () => {
    await expect(repository.remover('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
      SubFichaNaoEncontradaError
    );
  });

  it('deve lançar InsumoBeneficiadoNaoEncontradoError se o beneficiado não existir', async () => {
    const bruto = await prisma.insumo.create({
      data: { nome: 'Bruto Existente', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 10, estoqueMinimo: 0 },
    });

    await expect(
      repository.vincular({
        insumoBeneficiadoId: '00000000-0000-0000-0000-000000000000',
        insumoBrutoId: bruto.id,
        quantidadeNecessaria: 0.5,
      })
    ).rejects.toThrow(InsumoBeneficiadoNaoEncontradoError);
  });

  it('deve lançar InsumoNaoBeneficiadoError se o beneficiado não tiver a flag produzidoInternamente', async () => {
    const beneficiadoInvalido = await prisma.insumo.create({
      data: {
        nome: 'Insumo Comum Nao Beneficiado',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 10,
        estoqueMinimo: 0,
        produzidoInternamente: false,
      },
    });
    const bruto = await prisma.insumo.create({
      data: { nome: 'Bruto Existente 2', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 10, estoqueMinimo: 0 },
    });

    await expect(
      repository.vincular({
        insumoBeneficiadoId: beneficiadoInvalido.id,
        insumoBrutoId: bruto.id,
        quantidadeNecessaria: 0.5,
      })
    ).rejects.toThrow(InsumoNaoBeneficiadoError);
  });

  it('deve lançar InsumoBrutoNaoEncontradoError se o insumo bruto não existir', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Beneficiado OK',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 0,
        produzidoInternamente: true,
      },
    });

    await expect(
      repository.vincular({
        insumoBeneficiadoId: beneficiado.id,
        insumoBrutoId: '00000000-0000-0000-0000-000000000000',
        quantidadeNecessaria: 0.5,
      })
    ).rejects.toThrow(InsumoBrutoNaoEncontradoError);
  });

  it('deve capturar P2003 e lançar InsumoBeneficiadoNaoEncontradoError quando insumoBeneficiado for violado no banco real', async () => {
    const bruto = await prisma.insumo.create({
      data: {
        nome: 'Bruto Para FK Test',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 100,
        estoqueMinimo: 0,
      },
    });

    const fakeBeneficiadoId = '00000000-0000-0000-0000-000000000099';

    // Bypassa apenas as checagens previas de leitura para que o upsert execute contra o Postgres real
    vi.spyOn(prisma.insumo, 'findUnique')
      .mockResolvedValueOnce({ id: fakeBeneficiadoId, produzidoInternamente: true } as any)
      .mockResolvedValueOnce({ id: bruto.id } as any);

    await expect(
      repository.vincular({
        insumoBeneficiadoId: fakeBeneficiadoId,
        insumoBrutoId: bruto.id,
        quantidadeNecessaria: 0.5,
      })
    ).rejects.toThrow(InsumoBeneficiadoNaoEncontradoError);

    vi.restoreAllMocks();
  });

  it('deve capturar P2003 e lançar InsumoBrutoNaoEncontradoError quando insumoBruto for violado no banco real', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Beneficiado Para FK Test',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 0,
        produzidoInternamente: true,
      },
    });

    const fakeBrutoId = '00000000-0000-0000-0000-000000000098';

    // Bypassa apenas as checagens previas de leitura para que o upsert execute contra o Postgres real
    vi.spyOn(prisma.insumo, 'findUnique')
      .mockResolvedValueOnce({ id: beneficiado.id, produzidoInternamente: true } as any)
      .mockResolvedValueOnce({ id: fakeBrutoId } as any);

    await expect(
      repository.vincular({
        insumoBeneficiadoId: beneficiado.id,
        insumoBrutoId: fakeBrutoId,
        quantidadeNecessaria: 0.5,
      })
    ).rejects.toThrow(InsumoBrutoNaoEncontradoError);

    vi.restoreAllMocks();
  });
});
