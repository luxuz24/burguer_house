import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ProducaoService, ProducaoError } from './producao.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('ProducaoService', () => {
  const service = new ProducaoService();

  beforeEach(async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve produzir item beneficiado com sucesso abatendo os insumos brutos e somando ao beneficiado', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Maionese Caseira',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 200,
        produzidoInternamente: true,
        validadeDias: 5,
      },
    });

    const oleo = await prisma.insumo.create({
      data: {
        nome: 'Óleo de Soja',
        unidade: 'Mililitros',
        fatorPerda: 0,
        estoqueAtual: 2000,
        estoqueMinimo: 500,
      },
    });

    const ovo = await prisma.insumo.create({
      data: {
        nome: 'Ovo',
        unidade: 'Unidade',
        fatorPerda: 0.1, // 10% de perda
        estoqueAtual: 50,
        estoqueMinimo: 10,
      },
    });

    // Sub-ficha por 1g de maionese:
    // 0.6ml de óleo e 0.02 ovos por grama
    await prisma.subFichaTecnica.create({
      data: {
        insumoBeneficiadoId: beneficiado.id,
        insumoBrutoId: oleo.id,
        quantidadeNecessaria: 0.6,
      },
    });

    await prisma.subFichaTecnica.create({
      data: {
        insumoBeneficiadoId: beneficiado.id,
        insumoBrutoId: ovo.id,
        quantidadeNecessaria: 0.02,
      },
    });

    // Produzir 500g de maionese
    const resultado = await service.produzir(beneficiado.id, 500);

    expect(resultado.quantidadeProduzida).toBe(500);
    expect(resultado.insumo.estoqueAtual).toBe(500);
    expect(resultado.validadeEm).toBeInstanceOf(Date);
    expect(resultado.consumos.length).toBe(2);

    // Verificar abatimento no banco
    const oleoAtualizado = await prisma.insumo.findUnique({ where: { id: oleo.id } });
    // consumo oleo: 0.6 * (1 + 0) * 500 = 300. 2000 - 300 = 1700
    expect(oleoAtualizado?.estoqueAtual).toBe(1700);

    const ovoAtualizado = await prisma.insumo.findUnique({ where: { id: ovo.id } });
    // consumo ovo: 0.02 * (1 + 0.1) * 500 = 0.02 * 1.1 * 500 = 11. 50 - 11 = 39
    expect(ovoAtualizado?.estoqueAtual).toBeCloseTo(39, 2);
  });

  it('deve lançar erro 404 se o insumo beneficiado não for encontrado', async () => {
    await expect(
      service.produzir('00000000-0000-0000-0000-000000000000', 100)
    ).rejects.toThrow(ProducaoError);

    try {
      await service.produzir('00000000-0000-0000-0000-000000000000', 100);
    } catch (e: any) {
      expect(e.status).toBe(404);
    }
  });

  it('deve lançar erro se o insumo não for marcado como produzidoInternamente', async () => {
    const insumoNormal = await prisma.insumo.create({
      data: {
        nome: 'Queijo Comprado',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
        produzidoInternamente: false,
      },
    });

    await expect(service.produzir(insumoNormal.id, 50)).rejects.toThrow(
      'Insumo não é marcado como produzido internamente'
    );
  });

  it('deve lançar erro se o insumo beneficiado não tiver sub-ficha técnica cadastrada', async () => {
    const beneficiadoSemFicha = await prisma.insumo.create({
      data: {
        nome: 'Molho Sem Receita',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 100,
        produzidoInternamente: true,
      },
    });

    await expect(service.produzir(beneficiadoSemFicha.id, 100)).rejects.toThrow(
      'Insumo beneficiado não possui sub-ficha técnica'
    );
  });

  it('deve lançar erro 409 quando o estoque do insumo bruto for insuficiente e não alterar estoques', async () => {
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Molho Falta Ingrediente',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 100,
        produzidoInternamente: true,
      },
    });

    const bruto = await prisma.insumo.create({
      data: {
        nome: 'Ingrediente Escasso',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 10, // só tem 10g
        estoqueMinimo: 50,
      },
    });

    await prisma.subFichaTecnica.create({
      data: {
        insumoBeneficiadoId: beneficiado.id,
        insumoBrutoId: bruto.id,
        quantidadeNecessaria: 1, // precisa de 1g por g
      },
    });

    // Tentar produzir 50g (precisa de 50g, mas só tem 10g)
    try {
      await service.produzir(beneficiado.id, 50);
      expect.fail('Deveria ter lançado ProducaoError');
    } catch (e: any) {
      expect(e).toBeInstanceOf(ProducaoError);
      expect(e.status).toBe(409);
      expect(e.message).toContain('Estoque insuficiente');
    }

    // Verificar que a transação não alterou nada
    const beneficiadoDb = await prisma.insumo.findUnique({ where: { id: beneficiado.id } });
    expect(beneficiadoDb?.estoqueAtual).toBe(0);

    const brutoDb = await prisma.insumo.findUnique({ where: { id: bruto.id } });
    expect(brutoDb?.estoqueAtual).toBe(10);
  });
});

describe('ProducaoService (concorrência)', () => {
  it('reverte com 409 se o estoque do bruto acabar entre a checagem e o abatimento', async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});

    const bruto = await prisma.insumo.create({
      data: { nome: 'Óleo Concorrente', unidade: 'Mililitros', fatorPerda: 0, estoqueAtual: 1000, estoqueMinimo: 0 },
    });
    const beneficiado = await prisma.insumo.create({
      data: {
        nome: 'Maionese Concorrente',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 0,
        estoqueMinimo: 0,
        produzidoInternamente: true,
      },
    });
    await prisma.subFichaTecnica.create({
      data: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: bruto.id, quantidadeNecessaria: 1 },
    });

    // Simula outra produção/venda consumindo o óleo logo depois que esta transação leu o saldo (1000).
    const comConcorrente = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        prisma.$transaction(async (tx) => {
          const subFicha = new Proxy(tx.subFichaTecnica, {
            get(alvo, prop) {
              if (prop === 'findMany') {
                return async (args: Parameters<typeof tx.subFichaTecnica.findMany>[0]) => {
                  const lidos = await alvo.findMany(args);
                  await prisma.insumo.update({ where: { id: bruto.id }, data: { estoqueAtual: 100 } });
                  return lidos;
                };
              }
              return Reflect.get(alvo, prop);
            },
          });
          return fn(new Proxy(tx, { get: (alvo, prop) => (prop === 'subFichaTecnica' ? subFicha : Reflect.get(alvo, prop)) }));
        }),
    } as unknown as typeof prisma;

    await expect(new ProducaoService(comConcorrente).produzir(beneficiado.id, 500)).rejects.toMatchObject({
      status: 409,
    });

    // nada foi abatido nem produzido (rollback), e o estoque não ficou negativo
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: bruto.id } })).estoqueAtual).toBe(100);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: beneficiado.id } })).estoqueAtual).toBe(0);

    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });
});
