import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import {
  EntradaManualService,
  EntradaManualError,
} from './entrada_manual.service.js';

async function limparBanco() {
  await prisma.movimentacaoEstoque.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.notaFiscal.deleteMany().catch(() => {});
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
  await prisma.usuario.deleteMany().catch(() => {});
}

describe('EntradaManualService', () => {
  const service = new EntradaManualService();

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect().catch(() => {});
  });

  it('rejeita itens duplicados e entradas inválidas diretamente no serviço', async () => {
    const ins = await prisma.insumo.create({ data: { nome: 'Cebola', unidade: 'Gramas' } });

    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'serv-chave-001',
        itens: [
          { insumoId: ins.id, quantidade: 10 },
          { insumoId: ins.id, quantidade: 20 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      name: 'EntradaManualError',
      status: 400,
      message: 'Não é permitido repetir o mesmo insumo na mesma requisição',
    });

    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'serv-chave-002',
        itens: [],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      name: 'EntradaManualError',
      status: 400,
      message: 'Informe ao menos um item para entrada manual',
    });
  });

  it('aborta transação inteira (404) se algum insumoId não existir', async () => {
    const ins = await prisma.insumo.create({
      data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 },
    });
    const faltandoId = '00000000-0000-0000-0000-000000000000';

    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'serv-404-001',
        itens: [
          { insumoId: ins.id, quantidade: 5 },
          { insumoId: faltandoId, quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: `Insumo(s) não encontrado(s): ${faltandoId}`,
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(10);
    expect(await prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it('não emite aviso quando custoAtual == 0 ou variação exatamente 10x (para cima/baixo) ou custo == 0, mas emite > 10x', async () => {
    const semCusto = await prisma.insumo.create({
      data: { nome: 'Gelo', unidade: 'Gramas', estoqueAtual: 0, custoUnitario: 0 },
    });
    const comCusto = await prisma.insumo.create({
      data: { nome: 'Queijo', unidade: 'Gramas', estoqueAtual: 100, custoUnitario: 0.1 },
    });

    // custoAtual == 0 não gera aviso; exatamente 10x para cima (0.1 -> 1.0) não gera aviso
    const r1 = await service.registrarEntradaManual({
      chaveIdempotencia: 'serv-aviso-001',
      itens: [
        { insumoId: semCusto.id, quantidade: 1000, custoUnitario: 0.02 },
        { insumoId: comCusto.id, quantidade: 500, custoUnitario: 1.0 },
      ],
      usuarioId: null,
    });
    expect(r1.avisos).toEqual([]);

    // Exatamente 10x para baixo (1.0 -> 0.1) e custo 0 sobre custo > 0 também NÃO geram aviso
    const rLimite = await service.registrarEntradaManual({
      chaveIdempotencia: 'serv-aviso-001b',
      itens: [
        { insumoId: comCusto.id, quantidade: 100, custoUnitario: 0.1 },
        { insumoId: semCusto.id, quantidade: 100, custoUnitario: 0 },
      ],
      usuarioId: null,
    });
    expect(rLimite.avisos).toEqual([]);

    // Mais de 10x menor (0.1 -> 0.009) gera aviso
    const r2 = await service.registrarEntradaManual({
      chaveIdempotencia: 'serv-aviso-002',
      itens: [{ insumoId: comCusto.id, quantidade: 500, custoUnitario: 0.009 }],
      usuarioId: null,
    });
    expect(r2.avisos).toHaveLength(1);
    expect(r2.avisos[0]).toContain('Queijo');
  });

  it('diferencia chaves com dois-pontos no prefixo, faz trim de observacao e detecta conflito em tamanho/obs/custo', async () => {
    const ins = await prisma.insumo.create({
      data: { nome: 'Bacon', unidade: 'Gramas', estoqueAtual: 100, custoUnitario: 0.05 },
    });
    const ins2 = await prisma.insumo.create({
      data: { nome: 'Cheddar', unidade: 'Gramas', estoqueAtual: 50, custoUnitario: 0.06 },
    });

    // Chave mais longa contendo ":" gravada primeiro: busca pela chave mais curta não pode confundi-las
    await service.registrarEntradaManual({
      chaveIdempotencia: 'nota-abc:extra',
      observacao: '   Obs A   ',
      itens: [{ insumoId: ins.id, quantidade: 50, custoUnitario: 0.05 }],
      usuarioId: null,
    });

    const rCurta = await service.registrarEntradaManual({
      chaveIdempotencia: 'nota-abc',
      observacao: '   Obs A   ',
      itens: [{ insumoId: ins.id, quantidade: 50, custoUnitario: 0.05 }],
      usuarioId: null,
    });
    expect(rCurta.reaproveitado).toBe(false);

    const replayCurta = await service.registrarEntradaManual({
      chaveIdempotencia: 'nota-abc',
      observacao: 'Obs A',
      itens: [{ insumoId: ins.id, quantidade: 50, custoUnitario: 0.05 }],
      usuarioId: null,
    });
    expect(replayCurta.reaproveitado).toBe(true);
    expect(replayCurta.avisos).toEqual([]);

    // Mesma chave com quantidade diferente de itens -> 409
    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'nota-abc',
        observacao: 'Obs A',
        itens: [
          { insumoId: ins.id, quantidade: 50, custoUnitario: 0.05 },
          { insumoId: ins2.id, quantidade: 10, custoUnitario: 0.06 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Já existe uma entrada manual registrada com esta chave de idempotência e conteúdo diferente',
    });

    // Mesma chave com observação diferente -> 409
    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'nota-abc',
        observacao: 'Obs B',
        itens: [{ insumoId: ins.id, quantidade: 50, custoUnitario: 0.05 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Já existe uma entrada manual registrada com esta chave de idempotência e conteúdo diferente',
    });

    // Mesma chave com custoUnitario diferente -> 409
    await expect(
      service.registrarEntradaManual({
        chaveIdempotencia: 'nota-abc',
        observacao: 'Obs A',
        itens: [{ insumoId: ins.id, quantidade: 50, custoUnitario: 0.06 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('propaga erros não-P2002 da transação sem confundir com replay', async () => {
    const fakeDb = {
      $transaction: async () => {
        const err = new Error('Falha de conexão') as Error & { code?: string };
        err.code = 'P1001';
        throw err;
      },
    };
    const servMock = new EntradaManualService(fakeDb as any);
    await expect(
      servMock.registrarEntradaManual({
        chaveIdempotencia: 'serv-err-001',
        itens: [{ insumoId: '00000000-0000-0000-0000-000000000001', quantidade: 1 }],
        usuarioId: null,
      }),
    ).rejects.toThrow('Falha de conexão');
  });

  it('evita ruído de ponto flutuante em saldoAnterior (0.3 + 0.1) e exige sufixo UUID na busca por chaveIdempotencia', async () => {
    const ins = await prisma.insumo.create({
      data: { nome: 'Tempero Fracionado', unidade: 'Quilogramas', estoqueAtual: 0.3 },
    });

    // Registro legado/outro uso com 36 chars após ":" que NÃO é UUID
    await prisma.movimentacaoEstoque.create({
      data: {
        insumoId: ins.id,
        tipo: 'ENTRADA_MANUAL',
        quantidade: 0.1,
        saldoAnterior: 0.2,
        saldoPosterior: 0.3,
        chaveIdempotencia: 'chave-p1:123456789012345678901234567890123456',
      },
    });

    const resultado = await service.registrarEntradaManual({
      chaveIdempotencia: 'chave-p1',
      itens: [{ insumoId: ins.id, quantidade: 0.1 }],
      usuarioId: null,
    });

    expect(resultado.reaproveitado).toBe(false);
    expect(resultado.itens[0]?.saldoAnterior).toBe(0.3);
    expect(resultado.itens[0]?.saldoPosterior).toBeCloseTo(0.4, 6);
  });

  it('desempata movimentações com mesmo criadoEm por id desc em listarMovimentacoes', async () => {
    const ins = await prisma.insumo.create({ data: { nome: 'Sal', unidade: 'Gramas' } });
    const mesmoInstante = new Date('2026-11-16T10:00:00.000Z');
    await prisma.movimentacaoEstoque.createMany({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          insumoId: ins.id,
          tipo: 'ENTRADA_MANUAL',
          quantidade: 1,
          saldoAnterior: 0,
          saldoPosterior: 1,
          criadoEm: mesmoInstante,
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          insumoId: ins.id,
          tipo: 'ENTRADA_MANUAL',
          quantidade: 2,
          saldoAnterior: 1,
          saldoPosterior: 3,
          criadoEm: mesmoInstante,
        },
      ],
    });

    const lista = await service.listarMovimentacoes({ limite: 10, offset: 0 });
    expect(lista.movimentacoes.map((m) => m.id)).toEqual([
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
    ]);
  });
});
