import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { ConsolidacaoService } from '../../modules/vendas/services/consolidacao.service.js';

const H = { 'x-webhook-secret': 'segredo-de-teste' };
const ITENS = [{ name: 'X-Burger', quantity: 2, price: 30, total: 60 }];

async function limpar() {
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

function evento(id: string, check: number, items = ITENS) {
  return app.inject({ method: 'POST', url: '/api/webhook/anota-ai', headers: H, payload: { id, check, items } });
}

async function cenario() {
  const carne = await prisma.insumo.create({
    data: { nome: 'Carne', unidade: 'Gramas', fatorPerda: 0, estoqueAtual: 1000, estoqueMinimo: 0 },
  });
  const produto = await prisma.produto.create({ data: { nome: 'X-Burger' } });
  await prisma.fichaTecnica.create({ data: { produtoId: produto.id, insumoId: carne.id, quantidade: 100 } });
  return carne;
}

const estoque = async (id: string) => (await prisma.insumo.findUniqueOrThrow({ where: { id } })).estoqueAtual;

describe('Webhook da Anota AI: vários eventos do mesmo pedido', () => {
  beforeAll(async () => {
    vi.stubEnv('ANOTAAI_WEBHOOK_SECRET', 'segredo-de-teste');
    await app.ready();
    await limpar();
  });
  afterAll(async () => {
    await limpar();
    vi.unstubAllEnvs();
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('pedido aceito e depois cancelado NÃO desconta o estoque', async () => {
    await limpar();
    const carne = await cenario();

    const aceito = await evento('ped-1', 1);
    const cancelado = await evento('ped-1', 4);

    expect(aceito.json()).toEqual({ received: true });
    expect(cancelado.json()).toEqual({ received: true, duplicate: true, updated: true });
    expect(await prisma.venda.count()).toBe(1);

    const r = await new ConsolidacaoService().consolidarVendasDoDia();

    expect(r.canceladasIgnoradas).toBe(1);
    expect(await estoque(carne.id)).toBe(1000);
  });

  it('pedido aceito e depois atualizado usa a quantidade mais recente', async () => {
    await limpar();
    const carne = await cenario();

    await evento('ped-2', 1, [{ name: 'X-Burger', quantity: 2, price: 30, total: 60 }]);
    const atualizado = await evento('ped-2', 1, [{ name: 'X-Burger', quantity: 1, price: 30, total: 30 }]);
    expect(atualizado.json()).toEqual({ received: true, duplicate: true, updated: true });

    await new ConsolidacaoService().consolidarVendasDoDia();

    expect(await estoque(carne.id)).toBe(900); // 1 x 100 g, e não 2 x 100 g
  });

  it('pedido em análise fica pendente; ao ser aceito, é abatido uma única vez', async () => {
    await limpar();
    const carne = await cenario();
    const consolidacao = new ConsolidacaoService();

    await evento('ped-3', 0);
    expect((await consolidacao.consolidarVendasDoDia()).vendasAguardando).toBe(1);
    expect(await estoque(carne.id)).toBe(1000);

    await evento('ped-3', 1);
    await consolidacao.consolidarVendasDoDia();
    await consolidacao.consolidarVendasDoDia();

    expect(await estoque(carne.id)).toBe(800);
  });

  it('cancelamento que chega DEPOIS da consolidação não reescreve a venda nem mexe no estoque', async () => {
    await limpar();
    const carne = await cenario();

    await evento('ped-4', 1);
    await new ConsolidacaoService().consolidarVendasDoDia();
    expect(await estoque(carne.id)).toBe(800);

    const tardio = await evento('ped-4', 4);

    expect(tardio.json()).toEqual({ received: true, duplicate: true });
    expect(await estoque(carne.id)).toBe(800); // decisão de negócio pendente: devolver ou não (ver docs/requests.md)
  });
});
