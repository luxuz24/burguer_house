import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  PerdasRepository,
  InsumoNaoEncontradoError,
  QuantidadeInvalidaError,
} from './perdas.repository.js';
import { prisma } from '../../../infra/database/prisma.js';
import { obterAnoEMesLoja } from '../../../shared/datas.js';

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
        custoUnitario: 0.05, // 50 reais por kg = 0.05 por grama
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

    const { ano, mes } = obterAnoEMesLoja();
    const resumo = await repository.resumoMensal(ano, mes);

    expect(resumo.length).toBe(2);

    const vencimento = resumo.find((r) => r.motivo === 'VENCIMENTO');
    expect(vencimento).toBeDefined();
    expect(vencimento?.ocorrencias).toBe(2);
    // 200g * 0.05 = R$ 10.00
    expect(vencimento?.valorTotal).toBe(10);

    const estragado = resumo.find((r) => r.motivo === 'ESTRAGADO');
    expect(estragado).toBeDefined();
    expect(estragado?.ocorrencias).toBe(1);
    // 80g * 0.05 = R$ 4.00
    expect(estragado?.valorTotal).toBe(4);
  });

  it('preserva o valor histórico das perdas mesmo se o custoUnitario do insumo dobrar posteriormente por nova NF', async () => {
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Bacon Defumado Custo Histórico',
        unidade: 'Gramas',
        fatorPerda: 0,
        custoUnitario: 0.035, // R$ 35 por kg = 0.035/g
        estoqueAtual: 2000,
        estoqueMinimo: 200,
      },
    });

    const perda = await repository.registrar({
      insumoId: insumo.id,
      quantidade: 1000, // 1kg perdido
      motivo: 'ESTRAGADO',
    });

    expect(perda.custoUnitario).toBe(0.035);

    // Nova nota fiscal dá entrada e o preço do bacon sobe para o dobro (R$ 70/kg)
    await prisma.insumo.update({
      where: { id: insumo.id },
      data: { custoUnitario: 0.07 },
    });

    const { ano, mes } = obterAnoEMesLoja();
    const resumo = await repository.resumoMensal(ano, mes);
    const estragado = resumo.find((r) => r.motivo === 'ESTRAGADO');

    // Valor deve continuar 35 (1000 * 0.035), NUNCA 70
    expect(estragado?.valorTotal).toBe(35);
  });

  it('mantém valor 0 em perda registrada antes da primeira NF do insumo (cenário A2)', async () => {
    // Insumo novo recém-cadastrado sem compras ainda (custo 0)
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Molho Especial Sem Custo',
        unidade: 'Mililitros',
        fatorPerda: 0,
        custoUnitario: 0,
        estoqueAtual: 1000,
        estoqueMinimo: 100,
      },
    });

    const perda = await repository.registrar({
      insumoId: insumo.id,
      quantidade: 500,
      motivo: 'ESTRAGADO',
    });

    expect(perda.custoUnitario).toBe(0);

    // Chega a primeira nota fiscal desse insumo com custo de R$ 0,05 por ml
    await prisma.insumo.update({
      where: { id: insumo.id },
      data: { custoUnitario: 0.05 },
    });

    const { ano, mes } = obterAnoEMesLoja();
    const resumo = await repository.resumoMensal(ano, mes);
    const estragado = resumo.find((r) => r.motivo === 'ESTRAGADO');

    // Valor financeiro da perda original deve permanecer 0, NUNCA retroagir para 25
    expect(estragado?.valorTotal).toBe(0);
  });

  it('considera o fuso horário de Campo Grande (UTC-4) para perdas registradas às 22h de 31/10', async () => {
    const insumo = await prisma.insumo.create({
      data: {
        nome: 'Pão Fuso MS',
        unidade: 'Unidade',
        fatorPerda: 0,
        custoUnitario: 2.0,
        estoqueAtual: 50,
        estoqueMinimo: 5,
      },
    });

    // 22h de 31/10 em Campo Grande é 02:00:00Z de 01/11 em UTC
    await prisma.perda.create({
      data: {
        insumoId: insumo.id,
        quantidade: 10,
        motivo: 'VENCIMENTO',
        custoUnitario: 2.0,
        criadoEm: new Date('2026-11-01T02:00:00.000Z'),
      },
    });

    // Em outubro (ano 2026, mes 10) no fuso de MS, a perda DEVE constar
    const resumoOutubro = await repository.resumoMensal(2026, 10);
    const vencimentoOutubro = resumoOutubro.find((r) => r.motivo === 'VENCIMENTO');
    expect(vencimentoOutubro).toBeDefined();
    expect(vencimentoOutubro?.valorTotal).toBe(20);

    // Em novembro (ano 2026, mes 11) no fuso de MS, ela NÃO deve constar
    const resumoNovembro = await repository.resumoMensal(2026, 11);
    const vencimentoNovembro = resumoNovembro.find((r) => r.motivo === 'VENCIMENTO');
    expect(vencimentoNovembro).toBeUndefined();
  });

  it('rejeita registro de perda com quantidade menor ou igual a zero ou inválida lançando QuantidadeInvalidaError', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Insumo Validação', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 100, estoqueMinimo: 0 },
    });

    await expect(repository.registrar({ insumoId: insumo.id, quantidade: 0, motivo: 'OUTRO' })).rejects.toThrow(
      QuantidadeInvalidaError
    );
    await expect(repository.registrar({ insumoId: insumo.id, quantidade: -5, motivo: 'OUTRO' })).rejects.toThrow(
      QuantidadeInvalidaError
    );
    await expect(repository.registrar({ insumoId: insumo.id, quantidade: NaN, motivo: 'OUTRO' })).rejects.toThrow(
      QuantidadeInvalidaError
    );
  });

  it('não sinaliza estoque negativo quando há saldo suficiente', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Alface Teste Saldo', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 500, estoqueMinimo: 0 },
    });

    const perda = await repository.registrar({ insumoId: insumo.id, quantidade: 200, motivo: 'ESTRAGADO' });

    expect(perda.estoqueNegativo).toBe(false);
  });

  it('aceita perda maior que o saldo, registra e sinaliza estoque negativo', async () => {
    const insumo = await prisma.insumo.create({
      data: { nome: 'Tomate Teste Negativo', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 100, estoqueMinimo: 0 },
    });

    const perda = await repository.registrar({ insumoId: insumo.id, quantidade: 250, motivo: 'VENCIMENTO' });

    expect(perda.estoqueNegativo).toBe(true);
    expect(await prisma.perda.count()).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } })).estoqueAtual).toBe(-150);
  });
});
