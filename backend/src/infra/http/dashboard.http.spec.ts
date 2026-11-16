import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { obterPartesDataLoja } from '../../shared/datas.js';

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
}

function formatarDiaMenos(diasAtras: number): string {
  const base = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
  const { ano, mes, dia } = obterPartesDataLoja(base);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

describe('Dashboard e Relatórios por ocorridoEm e origem (HTTP)', () => {
  let auth: Record<string, string>;
  const usuarioId = 'user-dashboard-http-24';

  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: usuarioId },
      update: { ativo: true, tokenVersion: 0, nome: 'Gerente Relatórios' },
      create: {
        id: usuarioId,
        nome: 'Gerente Relatórios',
        email: 'dash24.http@teste.com',
        senha: 'hash',
        role: 'GERENTE',
        ativo: true,
        tokenVersion: 0,
      },
    });
    const token = app.jwt.sign({
      sub: usuarioId,
      email: 'dash24.http@teste.com',
      role: 'GERENTE',
      tv: 0,
    });
    auth = { authorization: `Bearer ${token}` };
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: usuarioId } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('atribui fechamento manual de 3 dias atrás ao dia ocorridoEm (não a hoje), exclui estornadas e expõe vendasManuaisQtd/Valor como subconjunto', async () => {
    const pao = await prisma.insumo.create({
      data: { nome: 'Pão Dash 24', unidade: 'Unidade', custoUnitario: 2, estoqueAtual: 100 },
    });
    const burger = await prisma.produto.create({
      data: {
        nome: 'Burger Dash 24',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });

    const dataTresDiasAtras = formatarDiaMenos(3);
    const dataHoje = formatarDiaMenos(0);

    // 1) Fechamento manual retroativo de 3 dias atrás (criadoEm = hoje, ocorridoEm = 3 dias atrás 12:00 MS)
    const fechRetro = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: {
        chaveIdempotencia: 'dash24-retro-3dias-01',
        data: dataTresDiasAtras,
        itens: [{ produtoId: burger.id, quantidade: 2 }],
      },
    });
    expect(fechRetro.statusCode).toBe(201);

    // 2) Fechamento manual de hoje que será estornado -> não deve aparecer em lugar nenhum
    const fechHojeEstornado = await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: {
        chaveIdempotencia: 'dash24-estornado-hoje-01',
        data: dataHoje,
        itens: [{ produtoId: burger.id, quantidade: 5 }],
      },
    });
    expect(fechHojeEstornado.statusCode).toBe(201);
    const estornoRes = await app.inject({
      method: 'POST',
      url: `/api/vendas/${fechHojeEstornado.json().vendaId}/estornar`,
      headers: auth,
      payload: { motivo: 'Lançado errado' },
    });
    expect(estornoRes.statusCode).toBe(200);

    // 3) Venda WEBHOOK processada hoje (ocorridoEm = hoje)
    await prisma.venda.create({
      data: {
        externalId: 'hook-dash24-hoje',
        origem: 'WEBHOOK',
        ocorridoEm: new Date(),
        processado: true,
        payloadOriginal: {
          info: {
            id: 'hook-dash24-hoje',
            check: 1,
            items: [{ name: 'Burger Dash 24', quantity: 1, price: 35 }],
          },
        },
      },
    });

    // Hoje: só entra a WEBHOOK (1 venda, 35.00), sem manuais ativas -> vendasManuaisQtd/Valor = 0
    const resHoje = await app.inject({
      method: 'GET',
      url: '/api/dashboard/resumo?periodo=hoje',
      headers: auth,
    });
    expect(resHoje.statusCode).toBe(200);
    const dashHoje = resHoje.json();
    expect(dashHoje.kpis.totalVendasQtd).toBe(1);
    expect(dashHoje.kpis.totalVendasValor).toBe(35);
    expect(dashHoje.kpis.vendasManuaisQtd).toBe(0);
    expect(dashHoje.kpis.vendasManuaisValor).toBe(0);
    expect(dashHoje.itensMaisVendidos).toMatchObject([
      { produtoNome: 'Burger Dash 24', quantidadeVendida: 1 },
    ]);

    // Há 3 dias: entra o fechamento manual retroativo (subconjunto nos totais)
    const resRetro = await app.inject({
      method: 'GET',
      url: `/api/dashboard/resumo?dataInicio=${dataTresDiasAtras}&dataFim=${dataTresDiasAtras}`,
      headers: auth,
    });
    expect(resRetro.statusCode).toBe(200);
    const dashRetro = resRetro.json();
    expect(dashRetro.kpis.totalVendasQtd).toBe(1);
    expect(dashRetro.kpis.vendasManuaisQtd).toBe(1);
    expect(dashRetro.kpis.vendasManuaisValor).toBe(0);
    expect(dashRetro.consumoInsumos).toMatchObject([
      { nome: 'Pão Dash 24', quantidadeConsumida: 2 },
    ]);
    expect(dashRetro.itensMaisVendidos).toMatchObject([
      { produtoNome: 'Burger Dash 24', quantidadeVendida: 2 },
    ]);
  });

  it('mantém /api/vendas/retidas, consolidar e marcar-tratadas restritos a WEBHOOK pendente (ignora MANUAL)', async () => {
    const pao = await prisma.insumo.create({
      data: { nome: 'Pão Isolamento', unidade: 'Unidade', estoqueAtual: 50 },
    });
    const prod = await prisma.produto.create({
      data: {
        nome: 'Burger Isolamento',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });

    // Venda MANUAL normal + uma MANUAL forçada processado=false (defesa em profundidade por origem)
    await app.inject({
      method: 'POST',
      url: '/api/vendas/fechamento-manual',
      headers: auth,
      payload: {
        chaveIdempotencia: 'dash24-iso-manual-01',
        itens: [{ produtoId: prod.id, quantidade: 1 }],
      },
    });
    const manualNaoProc = await prisma.venda.create({
      data: {
        externalId: 'manual:forçada-false',
        origem: 'MANUAL',
        processado: false,
        payloadOriginal: {
          info: { id: 'manual:forçada-false', check: 1, items: [{ name: 'Sem Match', quantity: 1 }] },
        },
      },
    });

    // Venda WEBHOOK retida (produto não cadastrado)
    const hookRetida = await prisma.venda.create({
      data: {
        externalId: 'hook:retida-24',
        origem: 'WEBHOOK',
        processado: false,
        payloadOriginal: {
          info: { id: 'hook:retida-24', check: 1, items: [{ name: 'Produto Inexistente Webhook', quantity: 1 }] },
        },
      },
    });

    const retidasRes = await app.inject({
      method: 'GET',
      url: '/api/vendas/retidas',
      headers: auth,
    });
    expect(retidasRes.statusCode).toBe(200);
    const retidasBody = retidasRes.json();
    expect(retidasBody.totalPendentes).toBe(1);
    expect(retidasBody.totalRetidas).toBe(1);

    vi.stubEnv('CRON_SECRET', 'cron-secret-dash24');
    try {
      const consolidarRes = await app.inject({
        method: 'POST',
        url: '/api/vendas/consolidar',
        headers: { 'x-cron-secret': 'cron-secret-dash24' },
      });
      expect(consolidarRes.statusCode).toBe(200);
      expect(consolidarRes.json().consolidadas).toBe(0);
      expect((await prisma.venda.findUniqueOrThrow({ where: { id: manualNaoProc.id } })).processado).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }

    const tratarRes = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: formatarDiaMenos(0), motivo: 'Fim sombra' },
    });
    expect(tratarRes.statusCode).toBe(200);
    expect(tratarRes.json().marcadas).toBe(1);
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: hookRetida.id } })).processado).toBe(true);
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: manualNaoProc.id } })).processado).toBe(false);
  });
});
