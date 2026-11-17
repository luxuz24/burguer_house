import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

const GERENTE_ID = 'user-ajuste-gerente';
const OPERADOR_ID = 'user-ajuste-operador';
let authGerente: { authorization: string };
let authOperador: { authorization: string };

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

async function criarUsuario(id: string, role: 'GERENTE' | 'OPERADOR') {
  await prisma.usuario.upsert({
    where: { id },
    update: { ativo: true, tokenVersion: 0, role },
    create: { id, nome: `Usuário ${role}`, email: `${id}@burguerhouse.test`, senha: 'hash', role, ativo: true, tokenVersion: 0 },
  });
  return { authorization: `Bearer ${app.jwt.sign({ sub: id, email: `${id}@burguerhouse.test`, role, tv: 0 })}` };
}

function ajustar(payload: unknown, headers = authGerente) {
  return app.inject({ method: 'POST', url: '/api/estoque/ajustes', headers, payload: payload as object });
}

describe('Ajuste de estoque por contagem (POST /api/estoque/ajustes)', () => {
  beforeAll(async () => {
    await app.ready();
    authGerente = await criarUsuario(GERENTE_ID, 'GERENTE');
    authOperador = await criarUsuario(OPERADOR_ID, 'OPERADOR');
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: { in: [GERENTE_ID, OPERADOR_ID] } } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  it('exige JWT (401) e papel ADMIN ou GERENTE (OPERADOR recebe 403 e nada muda)', async () => {
    const ins = await prisma.insumo.create({ data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 } });
    const payload = { chaveIdempotencia: 'contagem-auth-1', motivo: 'Contagem inicial', itens: [{ insumoId: ins.id, saldoContado: 25 }] };

    const semJwt = await app.inject({ method: 'POST', url: '/api/estoque/ajustes', payload });
    expect(semJwt.statusCode).toBe(401);

    const operador = await ajustar(payload, authOperador);
    expect(operador.statusCode).toBe(403);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(10);
    expect(await prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it('valida o corpo com 400: motivo obrigatório (3..500), saldo contado >= 0, 1..200 itens, sem repetir insumo, chave 8..100', async () => {
    const ins = await prisma.insumo.create({ data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 } });
    const base = { chaveIdempotencia: 'contagem-valida-1', motivo: 'Contagem inicial', itens: [{ insumoId: ins.id, saldoContado: 5 }] };

    const invalidos: unknown[] = [
      { ...base, motivo: undefined },
      { ...base, motivo: '  a ' },
      { ...base, motivo: 'x'.repeat(501) },
      { ...base, itens: [{ insumoId: ins.id, saldoContado: -1 }] },
      { ...base, itens: [{ insumoId: ins.id, saldoContado: Number.NaN }] },
      { ...base, itens: [] },
      { ...base, itens: [{ insumoId: ins.id, saldoContado: 1 }, { insumoId: ins.id, saldoContado: 2 }] },
      { ...base, itens: [{ insumoId: 'nao-e-uuid', saldoContado: 1 }] },
      { ...base, chaveIdempotencia: 'curta' },
    ];
    for (const payload of invalidos) {
      const res = await ajustar(payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(10);
  });

  it('grava o saldo contado, registra AJUSTE com a diferença (positiva, negativa ou zero) e responde 201', async () => {
    const pao = await prisma.insumo.create({ data: { nome: 'Pão Brioche', unidade: 'Unidade', estoqueAtual: 10 } });
    const carne = await prisma.insumo.create({ data: { nome: 'Carne', unidade: 'Gramas', estoqueAtual: 4000 } });
    const sal = await prisma.insumo.create({ data: { nome: 'Sal', unidade: 'Gramas', estoqueAtual: 900.5 } });

    const res = await ajustar({
      chaveIdempotencia: 'contagem-inicial-01',
      motivo: '  Contagem inicial da loja  ',
      itens: [
        { insumoId: pao.id, saldoContado: 25 },
        { insumoId: carne.id, saldoContado: 3200 },
        { insumoId: sal.id, saldoContado: 900.5 },
      ],
    });

    expect(res.statusCode).toBe(201);
    const corpo = res.json();
    expect(corpo.reaproveitado).toBe(false);
    expect(corpo.itens).toEqual([
      { insumoId: pao.id, nome: 'Pão Brioche', unidade: 'Unidade', saldoAnterior: 10, saldoContado: 25, diferenca: 15 },
      { insumoId: carne.id, nome: 'Carne', unidade: 'Gramas', saldoAnterior: 4000, saldoContado: 3200, diferenca: -800 },
      { insumoId: sal.id, nome: 'Sal', unidade: 'Gramas', saldoAnterior: 900.5, saldoContado: 900.5, diferenca: 0 },
    ]);

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: pao.id } })).estoqueAtual).toBe(25);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(3200);

    const movs = await prisma.movimentacaoEstoque.findMany({ orderBy: { quantidade: 'asc' } });
    expect(movs).toHaveLength(3);
    expect(movs.map((m) => [m.tipo, m.quantidade, m.saldoAnterior, m.saldoPosterior])).toEqual([
      ['AJUSTE', -800, 4000, 3200],
      ['AJUSTE', 0, 900.5, 900.5],
      ['AJUSTE', 15, 10, 25],
    ]);
    for (const m of movs) {
      expect(m.observacao).toBe('Contagem inicial da loja');
      expect(m.usuarioId).toBe(GERENTE_ID);
      expect(m.custoUnitario).toBeNull();
    }
  });

  it('insumo inexistente devolve 404 com o id e não altera nenhum saldo', async () => {
    const pao = await prisma.insumo.create({ data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 } });
    const fantasma = randomUUID();

    const res = await ajustar({
      chaveIdempotencia: 'contagem-404-01',
      motivo: 'Contagem',
      itens: [{ insumoId: pao.id, saldoContado: 30 }, { insumoId: fantasma, saldoContado: 1 }],
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().message).toContain(fantasma);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: pao.id } })).estoqueAtual).toBe(10);
    expect(await prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it('reenvio com a mesma chave e o mesmo conteúdo devolve 200 reaproveitado sem mexer de novo; conteúdo diferente devolve 409', async () => {
    const pao = await prisma.insumo.create({ data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 } });
    const payload = { chaveIdempotencia: 'contagem-replay-01', motivo: 'Contagem semanal', itens: [{ insumoId: pao.id, saldoContado: 25 }] };

    expect((await ajustar(payload)).statusCode).toBe(201);
    // Vendas do dia mudam o saldo depois da contagem; o reenvio não pode voltar o saldo para 25
    await prisma.insumo.update({ where: { id: pao.id }, data: { estoqueAtual: 22 } });

    const replay = await ajustar(payload);
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({
      reaproveitado: true,
      itens: [{ insumoId: pao.id, saldoAnterior: 10, saldoContado: 25, diferenca: 15 }],
    });
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: pao.id } })).estoqueAtual).toBe(22);
    expect(await prisma.movimentacaoEstoque.count()).toBe(1);

    const outroSaldo = await ajustar({ ...payload, itens: [{ insumoId: pao.id, saldoContado: 26 }] });
    expect(outroSaldo.statusCode).toBe(409);
    const outroMotivo = await ajustar({ ...payload, motivo: 'Outro motivo' });
    expect(outroMotivo.statusCode).toBe(409);
    expect(await prisma.movimentacaoEstoque.count()).toBe(1);
  });

  it('ajustes concorrentes no mesmo insumo são serializados: o saldo final é o de um deles e o histórico encadeia os dois', async () => {
    const pao = await prisma.insumo.create({ data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 10 } });

    const [a, b] = await Promise.all([
      ajustar({ chaveIdempotencia: 'contagem-conc-a', motivo: 'Contagem A', itens: [{ insumoId: pao.id, saldoContado: 30 }] }),
      ajustar({ chaveIdempotencia: 'contagem-conc-b', motivo: 'Contagem B', itens: [{ insumoId: pao.id, saldoContado: 50 }] }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);

    const movs = await prisma.movimentacaoEstoque.findMany({ where: { insumoId: pao.id }, orderBy: { criadoEm: 'asc' } });
    expect(movs).toHaveLength(2);
    const [primeiro, segundo] = movs[0]!.saldoAnterior === 10 ? [movs[0]!, movs[1]!] : [movs[1]!, movs[0]!];
    expect(primeiro.saldoAnterior).toBe(10);
    // O segundo leu o saldo já gravado pelo primeiro (sem leitura obsoleta)
    expect(segundo.saldoAnterior).toBe(primeiro.saldoPosterior);
    expect(segundo.quantidade).toBe(segundo.saldoPosterior - segundo.saldoAnterior);

    const final = (await prisma.insumo.findUniqueOrThrow({ where: { id: pao.id } })).estoqueAtual;
    expect(final).toBe(segundo.saldoPosterior);
  });

  it('o histórico (GET /api/estoque/movimentacoes) lista o AJUSTE com a diferença negativa', async () => {
    const carne = await prisma.insumo.create({ data: { nome: 'Carne', unidade: 'Gramas', estoqueAtual: 1000 } });
    await ajustar({ chaveIdempotencia: 'contagem-hist-01', motivo: 'Inventário', itens: [{ insumoId: carne.id, saldoContado: 750 }] });

    const res = await app.inject({ method: 'GET', url: `/api/estoque/movimentacoes?insumoId=${carne.id}`, headers: authGerente });
    expect(res.statusCode).toBe(200);
    expect(res.json().movimentacoes[0]).toMatchObject({
      tipo: 'AJUSTE',
      quantidade: -250,
      saldoAnterior: 1000,
      saldoPosterior: 750,
      observacao: 'Inventário',
      usuario: { id: GERENTE_ID },
    });
  });
});
