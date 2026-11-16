import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import { FechamentoManualService } from '../../vendas/services/fechamento_manual.service.js';
import { EstornarFechamentoService } from '../../vendas/services/estornar_fechamento.service.js';
import { SaidaDiaService, SaidaDiaError } from './saida_dia.service.js';

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

async function criarCardapio() {
  const pao = await prisma.insumo.create({
    data: { nome: 'Pão Saída', unidade: 'Unidade', categoria: 'INGREDIENTE', estoqueAtual: 100, estoqueMinimo: 10 },
  });
  const carne = await prisma.insumo.create({
    data: { nome: 'Carne Saída', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.05, estoqueAtual: 1000, estoqueMinimo: 900 },
  });
  const coca = await prisma.insumo.create({
    data: { nome: 'Coca Saída', unidade: 'Unidade', categoria: 'BEBIDA', estoqueAtual: 50, estoqueMinimo: 5 },
  });
  const saco = await prisma.insumo.create({
    data: { nome: 'Saco Saída', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 200, estoqueMinimo: 20 },
  });
  const burger = await prisma.produto.create({
    data: {
      nome: 'Burger Saída',
      fichasTecnicas: {
        create: [
          { insumoId: pao.id, quantidade: 1 },
          { insumoId: carne.id, quantidade: 160 },
          { insumoId: saco.id, quantidade: 1 },
        ],
      },
    },
  });
  const cocaProd = await prisma.produto.create({
    data: { nome: 'Coca Saída', fichasTecnicas: { create: [{ insumoId: coca.id, quantidade: 1 }] } },
  });
  return { pao, carne, coca, saco, burger, cocaProd };
}

function webhook(externalId: string, ocorridoEm: string, check: number, items: Array<{ name: string; quantity: number }>) {
  return prisma.venda.create({
    data: {
      externalId,
      origem: 'WEBHOOK',
      ocorridoEm: new Date(ocorridoEm),
      processado: true,
      payloadOriginal: { info: { id: externalId, check, items: items.map((i) => ({ ...i, price: 30 })) } },
    },
  });
}

describe('SaidaDiaService', () => {
  const service = new SaidaDiaService();
  const fechamento = new FechamentoManualService();

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect().catch(() => {});
  });

  it('soma webhook (pela ficha com fator de perda) e fechamento manual (pelo snapshot), sem nenhum valor em R$, ordenando por categoria e nome', async () => {
    const c = await criarCardapio();
    await webhook('hook-saida-1', '2026-01-10T15:00:00.000Z', 1, [
      { name: 'Burger Saída', quantity: 1 },
      { name: 'Coca Saída', quantity: 2 },
    ]);
    await fechamento.confirmar({
      chaveIdempotencia: 'saida-manual-01',
      data: '2026-01-10',
      itens: [{ produtoId: c.burger.id, quantidade: 2 }],
      usuarioId: null,
    });

    const r = await service.obter({ data: '2026-01-10' });

    expect(r.data).toBe('2026-01-10');
    expect(r.pedidos).toBe(2);
    expect(r.itens).toEqual([
      { nome: 'Burger Saída', quantidade: 3 },
      { nome: 'Coca Saída', quantidade: 2 },
    ]);
    expect(r.insumos.map((i) => [i.categoria, i.nome, i.quantidadeSaiu])).toEqual([
      ['INGREDIENTE', 'Carne Saída', 504],
      ['INGREDIENTE', 'Pão Saída', 3],
      ['EMBALAGEM', 'Saco Saída', 3],
      ['BEBIDA', 'Coca Saída', 2],
    ]);
    // estoque atual: só o fechamento manual abateu (carne 1000 - 336); o webhook foi gravado sem consolidar
    const carne = r.insumos.find((i) => i.nome === 'Carne Saída')!;
    expect(carne).toMatchObject({ unidade: 'Gramas', estoqueAtual: 664, estoqueMinimo: 900, emAlerta: true });
    expect(r.insumos.find((i) => i.nome === 'Pão Saída')!.emAlerta).toBe(false);

    const texto = JSON.stringify(r).toLowerCase();
    for (const proibida of ['preco', 'price', 'valor', 'custo', 'r$']) {
      expect(texto).not.toContain(proibida);
    }
  });

  it('exclui fechamento estornado e pedidos de webhook que não abatem (cancelado e agendado)', async () => {
    const c = await criarCardapio();
    const f = await fechamento.confirmar({
      chaveIdempotencia: 'saida-manual-02',
      data: '2026-01-10',
      itens: [{ produtoId: c.burger.id, quantidade: 5 }],
      usuarioId: null,
    });
    await new EstornarFechamentoService().executar({ vendaId: f.vendaId, motivo: 'Erro', usuarioId: null });
    await webhook('hook-cancelado', '2026-01-10T15:00:00.000Z', 4, [{ name: 'Burger Saída', quantity: 7 }]);
    await webhook('hook-agendado', '2026-01-10T15:00:00.000Z', -2, [{ name: 'Burger Saída', quantity: 9 }]);
    await webhook('hook-ok', '2026-01-10T15:00:00.000Z', 1, [{ name: 'Burger Saída', quantity: 1 }]);

    const r = await service.obter({ data: '2026-01-10' });
    expect(r.pedidos).toBe(1);
    expect(r.itens).toEqual([{ nome: 'Burger Saída', quantidade: 1 }]);
    expect(r.insumos.find((i) => i.nome === 'Pão Saída')!.quantidadeSaiu).toBe(1);
  });

  it('alterar a ficha técnica depois do fechamento manual não muda o que saiu (usa o snapshot)', async () => {
    const c = await criarCardapio();
    await fechamento.confirmar({
      chaveIdempotencia: 'saida-manual-03',
      data: '2026-01-10',
      itens: [{ produtoId: c.burger.id, quantidade: 2 }],
      usuarioId: null,
    });
    await prisma.fichaTecnica.updateMany({ where: { produtoId: c.burger.id, insumoId: c.pao.id }, data: { quantidade: 4 } });

    const r = await service.obter({ data: '2026-01-10' });
    expect(r.insumos.find((i) => i.nome === 'Pão Saída')!.quantidadeSaiu).toBe(2);
  });

  it('fechamento lançado depois com ocorridoEm de dias atrás aparece no dia dele e não em hoje', async () => {
    const c = await criarCardapio();
    await fechamento.confirmar({
      chaveIdempotencia: 'saida-manual-04',
      data: '2026-01-07',
      itens: [{ produtoId: c.burger.id, quantidade: 1 }],
      usuarioId: null,
    });
    expect((await service.obter({ data: '2026-01-07' })).pedidos).toBe(1);
    expect((await service.obter({ data: '2026-01-10' })).pedidos).toBe(0);
  });

  it('sem data usa ontem em America/Campo_Grande (UTC já virou o dia), e valida data inválida e futura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      // 2026-04-05 22:30 em Campo_Grande = 2026-04-06T02:30Z -> ontem = 2026-04-04
      vi.setSystemTime(new Date('2026-04-06T02:30:00.000Z'));
      await criarCardapio();
      await webhook('hook-ontem', '2026-04-04T16:00:00.000Z', 1, [{ name: 'Burger Saída', quantity: 1 }]);
      await webhook('hook-hoje', '2026-04-05T16:00:00.000Z', 1, [{ name: 'Burger Saída', quantity: 4 }]);

      const ontem = await service.obter({});
      expect(ontem.data).toBe('2026-04-04');
      expect(ontem.itens).toEqual([{ nome: 'Burger Saída', quantidade: 1 }]);

      const hoje = await service.obter({ data: '2026-04-05' });
      expect(hoje.itens).toEqual([{ nome: 'Burger Saída', quantidade: 4 }]);

      const futura = await service.obter({ data: '2026-04-10' });
      expect(futura).toEqual({ data: '2026-04-10', pedidos: 0, itens: [], insumos: [] });

      for (const invalida of ['2026-02-31', 'abc', '   ', '']) {
        await expect(service.obter({ data: invalida })).rejects.toMatchObject({
          name: 'SaidaDiaError',
          status: 400,
        });
      }
      expect(new SaidaDiaError('x', 400).status).toBe(400);
    } finally {
      vi.useRealTimers();
    }
  });

  it('conservação: o que saiu por insumo bate com o abatimento real do fechamento manual', async () => {
    const c = await criarCardapio();
    await fechamento.confirmar({
      chaveIdempotencia: 'saida-manual-05',
      data: '2026-01-10',
      itens: [
        { produtoId: c.burger.id, quantidade: 3 },
        { produtoId: c.cocaProd.id, quantidade: 4 },
      ],
      usuarioId: null,
    });
    const r = await service.obter({ data: '2026-01-10' });
    for (const ins of [c.pao, c.carne, c.coca, c.saco]) {
      const atual = await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } });
      const saiu = r.insumos.find((i) => i.insumoId === ins.id)!.quantidadeSaiu;
      expect(Number((ins.estoqueAtual - atual.estoqueAtual).toFixed(4))).toBe(saiu);
    }
  });

  it('ignora pedido sem itens, usa nome canônico do catálogo, mantém produto fora do catálogo e fallback de nome sem letras', async () => {
    await criarCardapio();
    await webhook('hook-vazio', '2026-01-10T15:00:00.000Z', 1, []);
    await webhook('hook-canonico', '2026-01-10T15:00:00.000Z', 1, [{ name: '  BURGER  saida ', quantity: 2 }]);
    await webhook('hook-fantasma', '2026-01-10T15:00:00.000Z', 1, [{ name: '  Lanche Fantasma  ', quantity: 1 }]);
    await webhook('hook-simbolos', '2026-01-10T15:00:00.000Z', 1, [{ name: '###', quantity: 5 }]);

    const r = await service.obter({ data: '  2026-01-10  ' });
    expect(r.data).toBe('2026-01-10');
    expect(r.pedidos).toBe(3);
    expect(r.itens).toEqual([
      { nome: '###', quantidade: 5 },
      { nome: 'Burger Saída', quantidade: 2 },
      { nome: 'Lanche Fantasma', quantidade: 1 },
    ]);
    // produto fora do catálogo não gera consumo de insumo; o canônico gera
    expect(r.insumos.find((i) => i.nome === 'Pão Saída')!.quantidadeSaiu).toBe(2);
  });

  it('nome ambíguo no catálogo (colisão) aparece nos itens, mas não baixa insumo', async () => {
    const c = await criarCardapio();
    await prisma.produto.create({
      data: { nome: 'BURGER SAÍDA', fichasTecnicas: { create: [{ insumoId: c.pao.id, quantidade: 9 }] } },
    });
    await webhook('hook-colisao', '2026-01-10T15:00:00.000Z', 1, [{ name: 'Burger Saída', quantity: 2 }]);

    const r = await service.obter({ data: '2026-01-10' });
    expect(r.pedidos).toBe(1);
    expect(r.itens).toEqual([{ nome: 'Burger Saída', quantidade: 2 }]);
    expect(r.insumos).toEqual([]);
  });

  it('ordena itens por quantidade decrescente (mesmo quando o menor chega primeiro) e desempata por nome; arredonda ruído de ponto flutuante', async () => {
    await criarCardapio();
    await webhook('hook-ord-1', '2026-01-10T15:00:00.000Z', 1, [
      { name: 'Zebra Lanche', quantity: 1 },
      { name: 'Ágata Lanche', quantity: 1 },
      { name: 'Meio Lanche', quantity: 3 },
    ]);
    await webhook('hook-fl-1', '2026-01-10T15:01:00.000Z', 1, [{ name: 'Decimal Lanche', quantity: 0.1 }]);
    await webhook('hook-fl-2', '2026-01-10T15:02:00.000Z', 1, [{ name: 'Decimal Lanche', quantity: 0.2 }]);

    const r = await service.obter({ data: '2026-01-10' });
    expect(r.itens).toEqual([
      { nome: 'Meio Lanche', quantidade: 3 },
      { nome: 'Ágata Lanche', quantidade: 1 },
      { nome: 'Zebra Lanche', quantidade: 1 },
      { nome: 'Decimal Lanche', quantidade: 0.3 },
    ]);
  });

  it('dia sem vendas devolve listas vazias; webhook com _fechamento no payload não usa o snapshot (só MANUAL usa)', async () => {
    const c = await criarCardapio();
    expect(await service.obter({ data: '2026-01-10' })).toEqual({ data: '2026-01-10', pedidos: 0, itens: [], insumos: [] });

    await prisma.venda.create({
      data: {
        externalId: 'hook-com-snapshot',
        origem: 'WEBHOOK',
        ocorridoEm: new Date('2026-01-10T15:00:00.000Z'),
        processado: true,
        payloadOriginal: {
          info: { id: 'hook-com-snapshot', check: 1, items: [{ name: 'Burger Saída', quantity: 1, price: 30 }] },
          _fechamento: { consumos: [{ insumoId: c.pao.id, quantidade: 999 }] },
        },
      },
    });
    const r = await service.obter({ data: '2026-01-10' });
    expect(r.insumos.find((i) => i.nome === 'Pão Saída')!.quantidadeSaiu).toBe(1);
  });

  it('defesa em profundidade: ignora venda estornada mesmo que o repositório a devolva', async () => {
    const c = await criarCardapio();
    const repoFalso = {
      buscarProdutosComFichas: async () => prisma.produto.findMany({ include: { fichasTecnicas: { include: { insumo: true } } } }),
      buscarVendasProcessadasPorPeriodo: async () => [
        {
          id: 'v1',
          origem: 'MANUAL' as const,
          ocorridoEm: new Date(),
          criadoEm: new Date(),
          payloadOriginal: {
            info: { id: 'manual:x', check: 1, items: [{ name: 'Burger Saída', quantity: 2 }] },
            _fechamento: { consumos: [{ insumoId: c.pao.id, quantidade: 2 }] },
            _estorno: { usuarioId: null, em: '2026-01-10T20:00:00.000Z', motivo: 'Erro' },
          },
        },
      ],
    };
    const r = await new SaidaDiaService(prisma, repoFalso as never).obter({ data: '2026-01-10' });
    expect(r).toEqual({ data: '2026-01-10', pedidos: 0, itens: [], insumos: [] });
  });

  it('fechamento manual sem snapshot válido (legado) conta o pedido e os itens, mas não inventa consumo de insumo', async () => {
    await criarCardapio();
    await prisma.venda.create({
      data: {
        externalId: 'manual:legado',
        origem: 'MANUAL',
        ocorridoEm: new Date('2026-01-10T16:00:00.000Z'),
        processado: true,
        payloadOriginal: { info: { id: 'manual:legado', check: 1, items: [{ name: 'Burger Saída', quantity: 2 }] } },
      },
    });
    const r = await service.obter({ data: '2026-01-10' });
    expect(r.pedidos).toBe(1);
    expect(r.itens).toEqual([{ nome: 'Burger Saída', quantidade: 2 }]);
    expect(r.insumos).toEqual([]);
  });
});
