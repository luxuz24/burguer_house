import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ConsolidacaoService } from './consolidacao.service.js';
import { prisma } from '../../../infra/database/prisma.js';

async function limpar() {
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.subFichaTecnica.deleteMany().catch(() => {});
  await prisma.perda.deleteMany().catch(() => {});
  await prisma.itemNotaFiscal.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

async function cenario(estoque = 1000) {
  const carne = await prisma.insumo.create({
    data: { nome: 'Carne', unidade: 'Gramas', fatorPerda: 0.1, estoqueAtual: estoque, estoqueMinimo: 0 },
  });
  const produto = await prisma.produto.create({ data: { nome: 'X-Burger' } });
  await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: carne.id, quantidade: 100 } });
  return { carne, produto };
}

describe('ConsolidacaoService', () => {
  const service = new ConsolidacaoService();

  beforeEach(limpar);
  afterAll(async () => {
    await limpar();
    await prisma.$disconnect().catch(() => {});
  });

  it('abate o estoque pela ficha técnica com fator de perda e marca as vendas como processadas', async () => {
    const { carne } = await cenario();
    await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: [{ name: 'x-burger', quantity: 2 }] } } });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    // 100 * 1.1 * 2 = 220
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(780);
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(0);
  });

  it('aborta sem abater estoque se outra execução reivindicar as vendas entre a leitura e a atualização', async () => {
    const { carne } = await cenario();
    for (let i = 0; i < 3; i++) {
      await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: [{ name: 'X-Burger', quantity: 1 }] } } });
    }

    // Simula a execução concorrente: logo após a leitura das pendentes, outra conexão as marca como processadas (commit).
    const comConcorrente = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>, opts?: object) =>
        prisma.$transaction(async (tx) => {
          const venda = new Proxy(tx.venda, {
            get(alvo, prop) {
              if (prop === 'findMany') {
                return async (args: Parameters<typeof tx.venda.findMany>[0]) => {
                  const lidas = await alvo.findMany(args);
                  await prisma.venda.updateMany({ data: { processado: true } });
                  return lidas;
                };
              }
              return Reflect.get(alvo, prop);
            },
          });
          return fn(new Proxy(tx, { get: (alvo, prop) => (prop === 'venda' ? venda : Reflect.get(alvo, prop)) }));
        }, opts),
    } as unknown as typeof prisma;

    const r = await new ConsolidacaoService(comConcorrente).consolidarVendasDoDia();

    expect(r.consolidadas).toBe(0);
    // estoque intacto: quem reivindicou primeiro é quem abate (aqui, ninguém abateu, então nada é descontado em dobro)
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
  });

  it('execuções sequenciais não descontam duas vezes', async () => {
    const { carne } = await cenario();
    await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: [{ name: 'X-Burger', quantity: 1 }] } } });

    await service.consolidarVendasDoDia();
    const segunda = await service.consolidarVendasDoDia();

    expect(segunda.consolidadas).toBe(0);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(890);
  });

  it('venda com payload malformado não trava o lote nem o estoque das demais e permanece pendente para conferência', async () => {
    const { carne } = await cenario();
    await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: {} } } });
    await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: [null, { name: 'X-Burger', quantity: 'abc' }] } } });
    await prisma.venda.create({ data: { payloadOriginal: { check: 1, items: [{ name: 'X-Burger', quantity: 1 }] } } });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    expect(r.vendasSemItens).toBe(2);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(890);
    // 1 venda válida processada; 2 vendas inválidas continuam pendentes (sem perda silenciosa de dados)
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(2);
  });

  it('permite estoque negativo e sinaliza; produto desconhecido é listado', async () => {
    await cenario(50);
    await prisma.venda.create({
      data: { payloadOriginal: { check: 1, items: [{ name: 'X-Burger', quantity: 1 }] } },
    });
    await prisma.venda.create({
      data: { payloadOriginal: { check: 1, items: [{ name: 'Lanche Fantasma', quantity: 1 }] } },
    });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    expect(r.insumosComEstoqueNegativo?.[0]?.nome).toBe('Carne');
    expect(r.insumosComEstoqueNegativo?.[0]?.estoqueAtual).toBeCloseTo(-60);
    expect(r.produtosNaoEncontrados).toEqual(['Lanche Fantasma']);
    expect(r.vendasPendentesNaoMapeadas).toBe(1);
  });

  it('sem vendas pendentes não faz nada', async () => {
    expect(await service.consolidarVendasDoDia()).toMatchObject({ consolidadas: 0 });
  });

  it('pedido cancelado (check 4) é descartado sem abater estoque', async () => {
    const { carne } = await cenario();
    await prisma.venda.create({
      data: { externalId: 'p-cancelado', payloadOriginal: { id: 'p-cancelado', check: 4, items: [{ name: 'X-Burger', quantity: 2 }] } },
    });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    expect(r.canceladasIgnoradas).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(0);
  });

  it('pedido ainda em análise (check 0) fica pendente e só abate depois de aceito', async () => {
    const { carne } = await cenario();
    await prisma.venda.create({
      data: { externalId: 'p-analise', payloadOriginal: { id: 'p-analise', check: 0, items: [{ name: 'X-Burger', quantity: 1 }] } },
    });

    const primeira = await service.consolidarVendasDoDia();
    expect(primeira.consolidadas).toBe(0);
    expect(primeira.vendasAguardando).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(1);

    // novo evento do mesmo pedido: aceito
    await prisma.venda.update({
      where: { externalId: 'p-analise' },
      data: { payloadOriginal: { id: 'p-analise', check: 1, items: [{ name: 'X-Burger', quantity: 1 }] } },
    });
    const segunda = await service.consolidarVendasDoDia();

    expect(segunda.consolidadas).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(890);
  });

  it('se chegar um cancelamento entre a leitura e a reivindicação, relê o estado e não abate', async () => {
    const { carne } = await cenario();
    const venda = await prisma.venda.create({
      data: { externalId: 'p-corrida', payloadOriginal: { id: 'p-corrida', check: 1, items: [{ name: 'X-Burger', quantity: 3 }] } },
    });

    let primeiraLeitura = true;
    const comWebhookNoMeio = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>, opts?: object) =>
        prisma.$transaction(async (tx) => {
          const modeloVenda = new Proxy(tx.venda, {
            get(alvo, prop) {
              if (prop === 'findMany') {
                return async (args: Parameters<typeof tx.venda.findMany>[0]) => {
                  const lidas = await alvo.findMany(args);
                  if (primeiraLeitura) {
                    primeiraLeitura = false;
                    await prisma.venda.update({
                      where: { id: venda.id },
                      data: { payloadOriginal: { id: 'p-corrida', check: 4, items: [{ name: 'X-Burger', quantity: 3 }] } },
                    });
                  }
                  return lidas;
                };
              }
              return Reflect.get(alvo, prop);
            },
          });
          return fn(new Proxy(tx, { get: (alvo, prop) => (prop === 'venda' ? modeloVenda : Reflect.get(alvo, prop)) }));
        }, opts),
    } as unknown as typeof prisma;

    const r = await new ConsolidacaoService(comWebhookNoMeio).consolidarVendasDoDia();

    expect(r.canceladasIgnoradas).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
  });

  it('venda com produto desconhecido NÃO é marcada como processada e não abate estoque (permanece pendente)', async () => {
    const { carne } = await cenario(1000);
    const venda = await prisma.venda.create({
      data: { payloadOriginal: { check: 1, items: [{ name: 'Lanche Inexistente', quantity: 1 }] } },
    });

    const r = await service.consolidarVendasDoDia();

    expect(r.produtosNaoEncontrados).toEqual(['Lanche Inexistente']);
    expect(r.vendasPendentesNaoMapeadas).toBe(1);
    const vendaNoBanco = await prisma.venda.findUniqueOrThrow({ where: { id: venda.id } });
    expect(vendaNoBanco.processado).toBe(false);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
  });

  it('encontra produto com variação de acentos e pontuação (ex: "x burger" vs "X-Burger")', async () => {
    const { carne } = await cenario(1000);
    await prisma.venda.create({
      data: { payloadOriginal: { check: 1, items: [{ name: '  x burger  ', quantity: 1 }] } },
    });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    expect(r.produtosNaoEncontrados).toBeUndefined();
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(890);
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(0);
  });

  it('abate insumos de adicionais/modificadores em subItems', async () => {
    const { carne } = await cenario(1000);
    const baconInsumo = await prisma.insumo.create({
      data: { nome: 'Bacon Insumo', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 500, estoqueMinimo: 0 },
    });
    const adicionalBacon = await prisma.produto.create({ data: { nome: 'Bacon Extra' } });
    await prisma.fichaTecnica.create({ data: { produtoId: adicionalBacon.id, insumoId: baconInsumo.id, quantidade: 50 } });

    await prisma.venda.create({
      data: {
        payloadOriginal: {
          check: 1,
          items: [
            {
              name: 'X-Burger',
              quantity: 2,
              subItems: [{ name: 'Bacon Extra', quantity: 1 }],
            },
          ],
        },
      },
    });

    const r = await service.consolidarVendasDoDia();

    expect(r.consolidadas).toBe(1);
    // 2 x-burgers = 2 * (100 * 1.1) = 220 carne -> 780
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBeCloseTo(780);
    // 2 x-burgers * 1 bacon extra cada = 2 * 50g = 100g bacon -> 400
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: baconInsumo.id } })).estoqueAtual).toBeCloseTo(400);
  });
});
