import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { EntradaEstoqueService } from './entrada_estoque.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('EntradaEstoqueService', () => {
  const service = new EntradaEstoqueService();

  beforeEach(async () => {
    await prisma.itemNotaFiscal.deleteMany().catch(() => {});
    await prisma.notaFiscal.deleteMany().catch(() => {});
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve confirmar entrada no almoxarifado incrementando o estoque e atualizando o custo unitario', async () => {
    const queijo = await prisma.insumo.create({
      data: {
        nome: 'Queijo Cheddar Entrada',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
        custoUnitario: 0.03,
      },
    });

    const resultado = await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567890',
      numero: '1234',
      serie: '1',
      fornecedorNome: 'Laticínios Brasil LTDA',
      fornecedorCnpj: '12345678000199',
      valorTotal: 100.0,
      itens: [
        {
          insumoId: queijo.id,
          quantidade: 2000, // +2000g
          valorUnitario: 0.05, // Novo custo unitário
          descricaoOriginal: 'QUEIJO CHEDDAR BARRA 2KG',
          unidadeOriginal: 'UN',
          quantidadeOriginal: 1,
          valorTotal: 100.0,
        },
      ],
    });

    expect(resultado.totalItensProcessados).toBe(1);
    expect(resultado.notaFiscalId).toBeDefined();
    expect(resultado.insumosAtualizados[0]?.novoEstoque).toBe(2500);
    expect(resultado.insumosAtualizados[0]?.custoUnitario).toBe(0.05);

    // Verifica no banco se o estoque e o custo unitário foram atualizados
    const queijoDb = await prisma.insumo.findUnique({ where: { id: queijo.id } });
    expect(queijoDb?.estoqueAtual).toBe(2500);
    expect(queijoDb?.custoUnitario).toBe(0.05);

    // Verifica se a NotaFiscal foi persistida
    const notaDb = await prisma.notaFiscal.findUnique({
      where: { chaveAcesso: '35261012345678000199550010000012341234567890' },
      include: { itens: true },
    });
    expect(notaDb).not.toBeNull();
    expect(notaDb?.fornecedorNome).toBe('Laticínios Brasil LTDA');
    expect(notaDb?.itens.length).toBe(1);
    expect(notaDb?.itens[0]?.insumoId).toBe(queijo.id);
    expect(notaDb?.itens[0]?.quantidadeConvertida).toBe(2000);
  });

  it('deve impedir importação duplicada da mesma nota fiscal pela chaveAcesso', async () => {
    const carne = await prisma.insumo.create({
      data: {
        nome: 'Carne Moída Teste',
        unidade: 'Gramas',
        estoqueAtual: 1000,
      },
    });

    const payload = {
      chaveAcesso: '41261099999999000188550010000055551234567890',
      fornecedorNome: 'Frigorífico Central',
      fornecedorCnpj: '99999999000188',
      itens: [
        {
          insumoId: carne.id,
          quantidade: 5000,
          valorUnitario: 0.035,
        },
      ],
    };

    // Primeira importação deve ter sucesso
    await service.confirmarEntrada(payload);

    // Segunda importação com a mesma chave deve ser rejeitada
    await expect(service.confirmarEntrada(payload)).rejects.toThrow(
      'A nota fiscal com chave de acesso 41261099999999000188550010000055551234567890 já foi importada anteriormente'
    );
  });

  it('deve listar notas fiscais importadas ordenadas por data', async () => {
    const pao = await prisma.insumo.create({
      data: {
        nome: 'Pão de Hambúrguer',
        unidade: 'Unidade',
        estoqueAtual: 100,
      },
    });

    await service.confirmarEntrada({
      chaveAcesso: '35261011111111000111550010000011111234567890',
      numero: '101',
      fornecedorNome: 'Panificadora Central',
      fornecedorCnpj: '11111111000111',
      itens: [
        {
          insumoId: pao.id,
          quantidade: 200,
          valorUnitario: 1.5,
          descricaoOriginal: 'PAO HAMBURGUER PCT 50UN',
        },
      ],
    });

    const notas = await service.listarNotasFiscais();
    expect(notas.length).toBeGreaterThanOrEqual(1);
    expect(notas[0]?.chaveAcesso).toBe('35261011111111000111550010000011111234567890');
    expect(notas[0]?.itens[0]?.insumo?.nome).toBe('Pão de Hambúrguer');
  });

  it('deve lançar erro se nenhum item for informado', async () => {
    await expect(
      service.confirmarEntrada({
        itens: [],
      })
    ).rejects.toThrow('Nenhum item informado para entrada de estoque');
  });
});
