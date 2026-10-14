import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { EntradaEstoqueService } from './entrada_estoque.service.js';
import { prisma } from '../../../infra/database/prisma.js';

describe('EntradaEstoqueService', () => {
  const service = new EntradaEstoqueService();

  beforeEach(async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.$disconnect().catch(() => {});
  });

  it('deve confirmar entrada no almoxarifado incrementando o estoque dos insumos mapeados', async () => {
    const queijo = await prisma.insumo.create({
      data: {
        nome: 'Queijo Cheddar Entrada',
        unidade: 'Gramas',
        fatorPerda: 0,
        estoqueAtual: 500,
        estoqueMinimo: 100,
      },
    });

    const resultado = await service.confirmarEntrada({
      chaveAcesso: '35261012345678000199550010000012341234567890',
      fornecedorNome: 'Laticínios Brasil',
      itens: [
        {
          insumoId: queijo.id,
          quantidade: 2000, // +2000g
          valorUnitario: 0.05,
        },
      ],
    });

    expect(resultado.totalItensProcessados).toBe(1);
    expect(resultado.insumosAtualizados[0]?.novoEstoque).toBe(2500);

    const queijoDb = await prisma.insumo.findUnique({ where: { id: queijo.id } });
    expect(queijoDb?.estoqueAtual).toBe(2500);
  });

  it('deve lançar erro se nenhum item for informado', async () => {
    await expect(
      service.confirmarEntrada({
        itens: [],
      })
    ).rejects.toThrow('Nenhum item informado para entrada de estoque');
  });
});
