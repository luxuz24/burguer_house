import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import {
  FechamentoManualService,
  FechamentoManualError,
} from './fechamento_manual.service.js';

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

describe('FechamentoManualService', () => {
  const service = new FechamentoManualService();

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect().catch(() => {});
  });

  it('usa a data de hoje em America/Campo_Grande quando data é omitida e rejeita data inválida ou futura', async () => {
    vi.useFakeTimers();
    try {
      // 2026-04-05 às 22:30 MS = 2026-04-06T02:30:00Z (dia já virou em UTC, mas em MS ainda é 2026-04-05; mês e dia < 10 testam padStart)
      vi.setSystemTime(new Date('2026-04-06T02:30:00.000Z'));

      const ins = await prisma.insumo.create({
        data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 50 },
      });
      const prod = await prisma.produto.create({
        data: {
          nome: 'Burger Fuso',
          fichasTecnicas: { create: [{ insumoId: ins.id, quantidade: 1 }] },
        },
      });

      const sim = await service.simular({
        itens: [{ produtoId: prod.id, quantidade: 2 }],
      });
      expect(sim.data).toBe('2026-04-05');

      const simHojeComEspacos = await service.simular({
        data: '  2026-04-05  ',
        itens: [{ produtoId: prod.id, quantidade: 1 }],
      });
      expect(simHojeComEspacos.data).toBe('2026-04-05');

      await expect(
        service.simular({
          data: '2026-04-06',
          itens: [{ produtoId: prod.id, quantidade: 1 }],
        }),
      ).rejects.toMatchObject({
        status: 400,
        name: 'FechamentoManualError',
        message: 'A data não pode ser futura',
      });

      await expect(
        service.simular({
          data: '2026-02-31',
          itens: [{ produtoId: prod.id, quantidade: 1 }],
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Data inválida; use o formato AAAA-MM-DD',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('ordena consumos da simulação: negativos primeiro, depois categoria e nome; trata estoque zerado e soma produtoId repetido', async () => {
    const carne = await prisma.insumo.create({
      data: { nome: 'Carne Bovina', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.1, estoqueAtual: 200 },
    });
    const papel = await prisma.insumo.create({
      data: { nome: 'Caixa Papelão', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 10 },
    });
    const coca = await prisma.insumo.create({
      data: { nome: 'Suco Laranja 300ml', unidade: 'Unidade', categoria: 'BEBIDA', estoqueAtual: 2 },
    });

    const burger = await prisma.produto.create({
      data: {
        nome: 'Burger Teste Ordem',
        fichasTecnicas: {
          create: [
            { insumoId: carne.id, quantidade: 100 }, // 100 * 1.1 = 110 por un; com 2 un = 220 -> fica -20 (negativo!)
            { insumoId: papel.id, quantidade: 1 },
          ],
        },
      },
    });
    const refri = await prisma.produto.create({
      data: {
        nome: 'Suco Laranja 300ml',
        fichasTecnicas: { create: [{ insumoId: coca.id, quantidade: 1 }] },
      },
    });

    // Passa BEBIDA positiva antes de INGREDIENTE negativa para forçar a ordenação por ficariaNegativo
    const sim = await service.simular({
      data: '2026-11-13',
      itens: [
        { produtoId: refri.id, quantidade: 1 },
        { produtoId: burger.id, quantidade: 1 },
        { produtoId: refri.id, quantidade: 1 }, // repetido soma para 2 -> Suco fica exatamente em 0 (não negativo!)
        { produtoId: burger.id, quantidade: 1 }, // repetido soma para 2
      ],
    });

    expect(sim.itens).toEqual([
      { produtoId: refri.id, nome: 'Suco Laranja 300ml', quantidade: 2 },
      { produtoId: burger.id, nome: 'Burger Teste Ordem', quantidade: 2 },
    ]);
    expect(sim.temNegativo).toBe(true);
    expect(sim.podeConfirmar).toBe(true);
    expect(
      sim.consumos.map((c) => ({
        nome: c.nome,
        categoria: c.categoria,
        consumo: c.consumo,
        estoqueProjetado: c.estoqueProjetado,
        neg: c.ficariaNegativo,
      })),
    ).toEqual([
      { nome: 'Carne Bovina', categoria: 'INGREDIENTE', consumo: 220, estoqueProjetado: -20, neg: true },
      { nome: 'Suco Laranja 300ml', categoria: 'BEBIDA', consumo: 2, estoqueProjetado: 0, neg: false },
      { nome: 'Caixa Papelão', categoria: 'EMBALAGEM', consumo: 2, estoqueProjetado: 8, neg: false },
    ]);
  });

  it('aborta confirmação inteira com 422 se houver produto sem ficha técnica e propaga erros não-P2002', async () => {
    const ins = await prisma.insumo.create({
      data: { nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 30 },
    });
    const comFicha = await prisma.produto.create({
      data: {
        nome: 'Com Ficha',
        fichasTecnicas: { create: [{ insumoId: ins.id, quantidade: 1 }] },
      },
    });
    const semFicha = await prisma.produto.create({
      data: { nome: 'Sem Ficha' },
    });

    const faltaId = randomUUID();
    await expect(
      service.simular({
        data: '2026-11-13',
        itens: [{ produtoId: faltaId, quantidade: 1 }],
      }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Um ou mais produtos informados não foram encontrados',
      detalhes: {
        produtosNaoEncontrados: [faltaId],
        produtosSemFicha: [],
      },
    });

    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-sem-ficha-001',
        data: '2026-11-13',
        itens: [
          { produtoId: comFicha.id, quantidade: 3 },
          { produtoId: semFicha.id, quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      name: 'FechamentoManualError',
      status: 422,
      message: 'Não é possível confirmar: existem produtos sem ficha técnica ou com conflito de nome',
      detalhes: {
        produtosNaoEncontrados: [],
        produtosSemFicha: [{ produtoId: semFicha.id, nome: 'Sem Ficha' }],
      },
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(30);
    expect(await prisma.venda.count()).toBe(0);

    // Erro não-P2002 não deve cair em replay
    const fakeDb = {
      $transaction: async () => {
        const err = new Error('Falha de rede') as Error & { code?: string };
        err.code = 'P1001';
        throw err;
      },
    };
    const servMock = new FechamentoManualService(fakeDb as any);
    await expect(
      servMock.confirmar({
        chaveIdempotencia: 'serv-err-001',
        data: '2026-11-13',
        itens: [{ produtoId: randomUUID(), quantidade: 1 }],
        usuarioId: null,
      }),
    ).rejects.toThrow('Falha de rede');
  });

  it('cobre listas vazias, desempate alfabético na mesma categoria, conflitos de data/observação/tamanho e colisão de nomes', async () => {
    await expect(service.simular({ itens: [] })).rejects.toMatchObject({
      status: 400,
      message: 'Informe ao menos um produto para simular',
    });
    await expect(
      service.confirmar({ chaveIdempotencia: 'serv-vazio-01', itens: [], usuarioId: null }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Informe ao menos um produto para confirmar o fechamento',
    });

    const saco = await prisma.insumo.create({
      data: { nome: 'Saco Kraft', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 50 },
    });
    const caixa = await prisma.insumo.create({
      data: { nome: 'Caixa Combo', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 50 },
    });
    const p1 = await prisma.produto.create({
      data: {
        nome: 'X-Burger',
        fichasTecnicas: {
          create: [
            { insumoId: saco.id, quantidade: 1 },
            { insumoId: caixa.id, quantidade: 1 },
          ],
        },
      },
    });
    const p2 = await prisma.produto.create({
      data: {
        nome: 'X Burger', // colide na normalização se ambos forem enviados juntos
        fichasTecnicas: { create: [{ insumoId: saco.id, quantidade: 1 }] },
      },
    });

    const sim = await service.simular({
      data: '2026-11-13',
      itens: [{ produtoId: p1.id, quantidade: 1 }],
    });
    expect(sim.consumos.map((c) => c.nome)).toEqual(['Caixa Combo', 'Saco Kraft']);

    const simColisao = await service.simular({
      data: '2026-11-13',
      itens: [
        { produtoId: p1.id, quantidade: 1 },
        { produtoId: p2.id, quantidade: 1 },
      ],
    });
    expect(simColisao.podeConfirmar).toBe(false);

    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-colisao-01',
        data: '2026-11-13',
        itens: [
          { produtoId: p1.id, quantidade: 1 },
          { produtoId: p2.id, quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 422 });

    const ok = await service.confirmar({
      chaveIdempotencia: 'serv-conflito-01',
      data: '2026-11-13',
      observacao: '  Turno noite  ',
      itens: [{ produtoId: p1.id, quantidade: 1 }],
      usuarioId: null,
    });
    expect(ok.insumosComEstoqueNegativo).toEqual([]);

    const replay = await service.confirmar({
      chaveIdempotencia: 'serv-conflito-01',
      data: '2026-11-13',
      observacao: 'Turno noite',
      itens: [{ produtoId: p1.id, quantidade: 1 }],
      usuarioId: null,
    });
    expect(replay.reaproveitado).toBe(true);
    expect(replay.insumosComEstoqueNegativo).toEqual([]);

    // Data diferente -> 409
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-conflito-01',
        data: '2026-11-12',
        observacao: 'Turno noite',
        itens: [{ produtoId: p1.id, quantidade: 1 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Já existe um fechamento manual registrado com esta chave de idempotência e conteúdo diferente',
    });

    // Observação diferente -> 409
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-conflito-01',
        data: '2026-11-13',
        observacao: 'Turno dia',
        itens: [{ produtoId: p1.id, quantidade: 1 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Tamanho de lista diferente -> 409
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-conflito-01',
        data: '2026-11-13',
        observacao: 'Turno noite',
        itens: [
          { produtoId: p1.id, quantidade: 1 },
          { produtoId: p2.id, quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('replay multi-item aceita ordem invertida e observação em branco, valida produtoId distinto com mesma qtd e reflete estoque zero vs negativo', async () => {
    const zera = await prisma.insumo.create({
      data: { nome: 'Embalagem Exata', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 2 },
    });
    const negativa = await prisma.insumo.create({
      data: { nome: 'Hambúrguer Artesanal', unidade: 'Unidade', categoria: 'INGREDIENTE', estoqueAtual: 1 },
    });
    const extra = await prisma.insumo.create({
      data: { nome: 'Guaraná Lata', unidade: 'Unidade', categoria: 'BEBIDA', estoqueAtual: 10 },
    });

    const burger = await prisma.produto.create({
      data: {
        nome: 'Duplo Casa',
        fichasTecnicas: {
          create: [
            { insumoId: zera.id, quantidade: 1 },
            { insumoId: negativa.id, quantidade: 1 },
          ],
        },
      },
    });
    const bebida = await prisma.produto.create({
      data: {
        nome: 'Guaraná Lata',
        fichasTecnicas: { create: [{ insumoId: extra.id, quantidade: 1 }] },
      },
    });
    const outroBurger = await prisma.produto.create({
      data: {
        nome: 'Triplo Casa',
        fichasTecnicas: { create: [{ insumoId: extra.id, quantidade: 1 }] },
      },
    });

    // Passa [bebida ('Guaraná...'), burger ('Duplo...')] para que payload gravado não esteja em ordem alfabética
    const primeiro = await service.confirmar({
      chaveIdempotencia: 'serv-replay-multi-01',
      data: '2026-11-13',
      itens: [
        { produtoId: bebida.id, quantidade: 1 },
        { produtoId: burger.id, quantidade: 2 },
      ],
      usuarioId: null,
    });

    expect(primeiro.reaproveitado).toBe(false);
    expect(primeiro.itens).toEqual([
      { produtoId: bebida.id, nome: 'Guaraná Lata', quantidade: 1 },
      { produtoId: burger.id, nome: 'Duplo Casa', quantidade: 2 },
    ]);
    // zera ficou exatamente em 0 (não entra em insumosComEstoqueNegativo); negativa ficou -1
    expect(primeiro.insumosComEstoqueNegativo).toEqual([
      { id: negativa.id, nome: 'Hambúrguer Artesanal', estoqueAtual: -1 },
    ]);

    // Replay com ordem invertida dos itens e observação só com espaços (normalizada para null)
    const replay = await service.confirmar({
      chaveIdempotencia: 'serv-replay-multi-01',
      data: '2026-11-13',
      observacao: '   ',
      itens: [
        { produtoId: burger.id, quantidade: 2 },
        { produtoId: bebida.id, quantidade: 1 },
      ],
      usuarioId: null,
    });

    expect(replay).toEqual({
      reaproveitado: true,
      vendaId: primeiro.vendaId,
      externalId: 'manual:serv-replay-multi-01',
      chaveIdempotencia: 'serv-replay-multi-01',
      data: '2026-11-13',
      ocorridoEm: '2026-11-13T16:00:00.000Z',
      itens: [
        { produtoId: burger.id, nome: 'Duplo Casa', quantidade: 2 },
        { produtoId: bebida.id, nome: 'Guaraná Lata', quantidade: 1 },
      ],
      consumos: primeiro.consumos,
      insumosComEstoqueNegativo: [{ id: negativa.id, nome: 'Hambúrguer Artesanal', estoqueAtual: -1 }],
    });

    // Lista menor com o primeiro item igual (em ordem ordenada) -> 409 (exige checagem de length)
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-replay-multi-01',
        data: '2026-11-13',
        itens: [{ produtoId: burger.id, quantidade: 2 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Mesmo tamanho de lista, primeira posição igual, segunda com produtoId distinto -> 409 (mata .some() no lugar de .every())
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-replay-multi-01',
        data: '2026-11-13',
        itens: [
          { produtoId: burger.id, quantidade: 2 },
          { produtoId: outroBurger.id, quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Produto inexistente no replay mesmo com mesmo tamanho de lista -> 409 (não crasheia)
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-replay-multi-01',
        data: '2026-11-13',
        itens: [
          { produtoId: burger.id, quantidade: 2 },
          { produtoId: randomUUID(), quantidade: 1 },
        ],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('replay funciona sem erro mesmo após apagar insumo da ficha e após renomear ou apagar produto', async () => {
    const insPrincipal = await prisma.insumo.create({
      data: { nome: 'Carne Snapshot', unidade: 'Gramas', estoqueAtual: 100 },
    });
    const insApagavel = await prisma.insumo.create({
      data: { nome: 'Queijo Temporário', unidade: 'Gramas', estoqueAtual: 10 },
    });
    const prod = await prisma.produto.create({
      data: {
        nome: 'Burger Antigo',
        fichasTecnicas: {
          create: [
            { insumoId: insPrincipal.id, quantidade: 100 },
            { insumoId: insApagavel.id, quantidade: 30 }, // fica -20
          ],
        },
      },
    });
    const prodHomonimo = await prisma.produto.create({
      data: {
        nome: 'Burger Outro',
        fichasTecnicas: { create: [{ insumoId: insPrincipal.id, quantidade: 100 }] },
      },
    });

    const primeiro = await service.confirmar({
      chaveIdempotencia: 'serv-snapshot-replay-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId: null,
    });

    // 1) Remove a ficha e apaga o insumo que havia ficado negativo; ajusta saldo do outro insumo
    await prisma.fichaTecnica.deleteMany({ where: { produtoId: prod.id } });
    await prisma.insumo.delete({ where: { id: insApagavel.id } });
    await prisma.insumo.update({ where: { id: insPrincipal.id }, data: { estoqueAtual: 500 } });

    const replayInsumoApagado = await service.confirmar({
      chaveIdempotencia: 'serv-snapshot-replay-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId: null,
    });

    expect(replayInsumoApagado).toEqual({
      reaproveitado: true,
      vendaId: primeiro.vendaId,
      externalId: 'manual:serv-snapshot-replay-01',
      chaveIdempotencia: 'serv-snapshot-replay-01',
      data: '2026-11-13',
      ocorridoEm: primeiro.ocorridoEm,
      itens: [{ produtoId: prod.id, nome: 'Burger Antigo', quantidade: 1 }],
      consumos: primeiro.consumos,
      insumosComEstoqueNegativo: [{ id: insApagavel.id, nome: 'Queijo Temporário', estoqueAtual: -20 }],
    });

    // 2) Renomeia o produto original e cria um com o nome antigo para garantir comparação por produtoId
    await prisma.produto.update({ where: { id: prod.id }, data: { nome: 'Burger Renomeado' } });
    await prisma.produto.update({ where: { id: prodHomonimo.id }, data: { nome: 'Burger Antigo' } });

    const replayRenomeado = await service.confirmar({
      chaveIdempotencia: 'serv-snapshot-replay-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId: null,
    });
    expect(replayRenomeado).toEqual(replayInsumoApagado);

    // Outro produtoId mesmo com o nome antigo -> 409
    await expect(
      service.confirmar({
        chaveIdempotencia: 'serv-snapshot-replay-01',
        data: '2026-11-13',
        itens: [{ produtoId: prodHomonimo.id, quantidade: 1 }],
        usuarioId: null,
      }),
    ).rejects.toMatchObject({ status: 409 });

    // Mesmo após apagar o próprio produto, retry com a mesma chave e produtoId continua idempotente
    await prisma.produto.delete({ where: { id: prod.id } });
    const replayProdutoApagado = await service.confirmar({
      chaveIdempotencia: 'serv-snapshot-replay-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId: null,
    });
    expect(replayProdutoApagado.reaproveitado).toBe(true);
    expect(replayProdutoApagado.itens).toEqual([{ produtoId: prod.id, nome: 'Burger Antigo', quantidade: 1 }]);
  });
});
