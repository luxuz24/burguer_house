import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { obterIntervaloDiaLoja, obterPartesDataLoja } from '../../shared/datas.js';

function formatarDiaLoja(data: Date): string {
  const { ano, mes, dia } = obterPartesDataLoja(data);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function obterDiasReferencia() {
  const { inicio: inicioHoje, fim: fimHoje } = obterIntervaloDiaLoja(new Date());
  const fimOntem = new Date(inicioHoje.getTime() - 1000); // 23:59:59 de ontem em MS
  const inicioAmanha = new Date(fimHoje.getTime() + 12 * 3600_000); // meio-dia de amanhã em MS
  return {
    ontem: formatarDiaLoja(fimOntem),
    hoje: formatarDiaLoja(inicioHoje),
    amanha: formatarDiaLoja(inicioAmanha),
    fimOntem,
    inicioHojeUtcPlus5Min: new Date(inicioHoje.getTime() + 5 * 60_000),
  };
}

let auth: { authorization: string };

async function limpar() {
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('POST /api/vendas/marcar-tratadas', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1-tratadas' },
      update: { role: 'ADMIN', ativo: true, tokenVersion: 0 },
      create: {
        id: 'u1-tratadas',
        nome: 'Operador Tratadas',
        email: 'tratadas@app-spec.test',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: 'u1-tratadas',
        email: 'tratadas@app-spec.test',
        role: 'ADMIN',
        tv: 0,
      })}`,
    };
  });

  beforeEach(async () => {
    vi.unstubAllEnvs();
    await limpar();
  });

  afterAll(async () => {
    await limpar();
    await prisma.usuario.deleteMany({ where: { id: 'u1-tratadas' } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('retorna 401 sem token JWT', async () => {
    const { ontem } = obterDiasReferencia();
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      payload: { ate: ontem, motivo: 'Modo sombra finalizado' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejeita data inexistente (2026-02-31) ou motivo vazio com 400', async () => {
    const { ontem } = obterDiasReferencia();
    const resDataInvalida = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: '2026-02-31', motivo: 'Fechamento manual' },
    });
    expect(resDataInvalida.statusCode).toBe(400);

    const resMotivoVazio = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: ontem, motivo: '   ' },
    });
    expect(resMotivoVazio.statusCode).toBe(400);
  });

  it('rejeita data futura (amanhã no fuso da loja) com 400 sem alterar vendas e permite data de hoje com 200', async () => {
    const { ontem, hoje, amanha, fimOntem, inicioHojeUtcPlus5Min } = obterDiasReferencia();

    const vendaOntem = await prisma.venda.create({
      data: {
        externalId: 'ped-futuro-1',
        payloadOriginal: { id: 'ped-futuro-1', check: 1 },
        criadoEm: fimOntem,
      },
    });
    const vendaHoje = await prisma.venda.create({
      data: {
        externalId: 'ped-futuro-2',
        payloadOriginal: { id: 'ped-futuro-2', check: 1 },
        criadoEm: inicioHojeUtcPlus5Min,
      },
    });

    const resFutura = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: amanha, motivo: 'Tentativa data futura' },
    });
    expect(resFutura.statusCode).toBe(400);
    expect(JSON.stringify(resFutura.json())).toContain('A data não pode ser futura');

    expect(await prisma.venda.count({ where: { processado: false } })).toBe(2);

    const resOntem = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: ontem, motivo: 'Tratar ontem' },
    });
    expect(resOntem.statusCode).toBe(200);
    expect(resOntem.json()).toEqual({ marcadas: 1, ate: ontem });
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: vendaOntem.id } })).processado).toBe(true);
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: vendaHoje.id } })).processado).toBe(false);

    const resHoje = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: hoje, motivo: 'Tratar hoje permitido' },
    });
    expect(resHoje.statusCode).toBe(200);
    expect(resHoje.json()).toEqual({ marcadas: 1, ate: hoje });
    expect((await prisma.venda.findUniqueOrThrow({ where: { id: vendaHoje.id } })).processado).toBe(true);
  });

  it('suporta simulacao: true contando sem alterar processado, e chamada real seguinte marca exatamente a mesma quantidade', async () => {
    const { ontem, fimOntem, inicioHojeUtcPlus5Min } = obterDiasReferencia();

    await prisma.venda.createMany({
      data: [
        {
          externalId: 'sim-1',
          payloadOriginal: { id: 'sim-1', check: 1 },
          processado: false,
          criadoEm: fimOntem,
        },
        {
          externalId: 'sim-2',
          payloadOriginal: { id: 'sim-2', check: 0 }, // inclusive em análise
          processado: false,
          criadoEm: fimOntem,
        },
        {
          externalId: 'sim-posterior',
          payloadOriginal: { id: 'sim-posterior', check: 1 },
          processado: false,
          criadoEm: inicioHojeUtcPlus5Min,
        },
      ],
    });

    const resSimulacao = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: ontem, motivo: 'Prévia do modo sombra', simulacao: true },
    });
    expect(resSimulacao.statusCode).toBe(200);
    expect(resSimulacao.json()).toEqual({ marcadas: 2, ate: ontem, simulacao: true });

    // Nenhuma venda foi alterada na simulação
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(3);

    const resReal = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: { ate: ontem, motivo: 'Execução real pós-simulação' },
    });
    expect(resReal.statusCode).toBe(200);
    expect(resReal.json()).toEqual({ marcadas: 2, ate: ontem });
    expect(await prisma.venda.count({ where: { processado: false } })).toBe(1);
  });

  it('marca vendas pendentes até o fim do dia no fuso da loja sem abater estoque, é idempotente e preserva vendas posteriores para consolidação', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron');

    const insumo = await prisma.insumo.create({
      data: { nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 10, estoqueMinimo: 2 },
    });
    const produto = await prisma.produto.create({
      data: { nome: 'X-Burger' },
    });
    await prisma.fichaTecnica.create({
      data: { produtoId: produto.id, insumoId: insumo.id, quantidade: 1 },
    });

    const payloadAntes = {
      id: 'ped-antes',
      check: 1,
      info: { items: [{ name: 'X-Burger', quantity: 1, price: 28 }] },
    };
    const payloadDepois = {
      id: 'ped-depois',
      check: 1,
      info: { items: [{ name: 'X-Burger', quantity: 1, price: 28 }] },
    };

    const { ontem, fimOntem, inicioHojeUtcPlus5Min } = obterDiasReferencia();

    // 23:59:59 de ontem em Campo Grande (ainda ontem na loja)
    const vendaAntes = await prisma.venda.create({
      data: {
        externalId: 'ped-antes',
        payloadOriginal: payloadAntes,
        criadoEm: fimOntem,
      },
    });

    // 00:05:00 de hoje em Campo Grande (já dia seguinte na loja)
    const vendaDepois = await prisma.venda.create({
      data: {
        externalId: 'ped-depois',
        payloadOriginal: payloadDepois,
        criadoEm: inicioHojeUtcPlus5Min,
      },
    });

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: {
        ate: ontem,
        motivo: 'Modo sombra encerrado após inventário manual',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ marcadas: 1, ate: ontem });

    // Chamada repetida na mesma data não altera nada (idempotência)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/vendas/marcar-tratadas',
      headers: auth,
      payload: {
        ate: ontem,
        motivo: 'Segunda tentativa idempotente',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ marcadas: 0, ate: ontem });

    // Estoque não foi abatido pela marcação
    const insumoAposMarcar = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } });
    expect(insumoAposMarcar.estoqueAtual).toBe(10);

    // Payload preservado com metadados de auditoria em _tratamento
    const vendaAntesDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaAntes.id } });
    expect(vendaAntesDb.processado).toBe(true);
    expect(vendaAntesDb.payloadOriginal).toMatchObject({
      ...payloadAntes,
      _tratamento: {
        motivo: 'Modo sombra encerrado após inventário manual',
        ate: ontem,
        usuarioId: 'u1-tratadas',
      },
    });
    expect(typeof (vendaAntesDb.payloadOriginal as any)._tratamento.marcadoEm).toBe('string');

    // A venda posterior continua pendente antes da consolidação
    const vendaDepoisAntesConsolidar = await prisma.venda.findUniqueOrThrow({ where: { id: vendaDepois.id } });
    expect(vendaDepoisAntesConsolidar.processado).toBe(false);

    // Consolidação subsequente abate APENAS a venda posterior (10 -> 9)
    const resConsolidar = await app.inject({
      method: 'POST',
      url: '/api/vendas/consolidar',
      headers: { 'x-cron-secret': 'segredo-do-cron' },
    });
    expect(resConsolidar.statusCode).toBe(200);
    expect(resConsolidar.json().consolidadas).toBe(1);

    const insumoAposConsolidar = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } });
    expect(insumoAposConsolidar.estoqueAtual).toBe(9);
  });
});
