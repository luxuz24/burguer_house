import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { EntradaManualService } from '../../modules/estoque/services/entrada_manual.service.js';

let auth: { authorization: string };
const USER_ID = 'user-estoque-http';

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

describe('Estoque HTTP API (/api/estoque)', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: USER_ID },
      update: { role: 'ADMIN', ativo: true, tokenVersion: 0, nome: 'Carlos Eduardo' },
      create: {
        id: USER_ID,
        nome: 'Carlos Eduardo',
        email: 'estoque@burguerhouse.test',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: USER_ID,
        email: 'estoque@burguerhouse.test',
        role: 'ADMIN',
        tv: 0,
      })}`,
    };
  });

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.usuario.deleteMany({ where: { id: USER_ID } }).catch(() => {});
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('Autenticação e validação (401 / 400)', () => {
    it('exige JWT válido em POST /entradas-manuais e GET /movimentacoes (401)', async () => {
      const postSemJwt = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        payload: {
          chaveIdempotencia: 'chave-sem-auth-1',
          itens: [{ insumoId: '00000000-0000-0000-0000-000000000001', quantidade: 1 }],
        },
      });
      expect(postSemJwt.statusCode).toBe(401);

      const getSemJwt = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes',
      });
      expect(getSemJwt.statusCode).toBe(401);
    });

    it('rejeita payloads inválidos e insumo repetido na mesma requisição com 400', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Coca Cola 350ml', unidade: 'Unidade', estoqueAtual: 10 },
      });

      const chaveCurta = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'curta',
          itens: [{ insumoId: ins.id, quantidade: 5 }],
        },
      });
      const chaveCurtaEspacos = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: '   curta   ',
          itens: [{ insumoId: ins.id, quantidade: 5 }],
        },
      });
      expect(chaveCurtaEspacos.statusCode).toBe(400);
      expect(chaveCurtaEspacos.json().issues[0].message).toBe('A chave de idempotência deve ter no mínimo 8 caracteres');

      const chaveLonga = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'x'.repeat(101),
          itens: [{ insumoId: ins.id, quantidade: 5 }],
        },
      });
      expect(chaveLonga.statusCode).toBe(400);
      expect(chaveLonga.json().issues[0].message).toBe('A chave de idempotência deve ter no máximo 100 caracteres');

      const obsLonga = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-obs-longa-1',
          observacao: 'a'.repeat(501),
          itens: [{ insumoId: ins.id, quantidade: 5 }],
        },
      });
      expect(obsLonga.statusCode).toBe(400);
      expect(obsLonga.json().issues[0].message).toBe('A observação deve ter no máximo 500 caracteres');

      const obsComEspacosNoLimite = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-obs-trim-500',
          observacao: `  ${'a'.repeat(500)}  `,
          itens: [{ insumoId: ins.id, quantidade: 1 }],
        },
      });
      expect(obsComEspacosNoLimite.statusCode).toBe(201);

      const semChave = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          itens: [{ insumoId: ins.id, quantidade: 5 }],
        },
      });
      expect(semChave.statusCode).toBe(400);

      const listaVazia = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-lista-vazia',
          itens: [],
        },
      });
      expect(listaVazia.statusCode).toBe(400);
      expect(listaVazia.json().issues[0].message).toBe('Informe ao menos um item');

      const listaAcima100 = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-acima-100',
          itens: Array.from({ length: 101 }, () => ({ insumoId: randomUUID(), quantidade: 1 })),
        },
      });
      expect(listaAcima100.statusCode).toBe(400);
      expect(listaAcima100.json().issues[0].message).toBe('Máximo de 100 itens por lançamento');

      const qtdZero = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-qtd-zero-1',
          itens: [{ insumoId: ins.id, quantidade: 0 }],
        },
      });
      expect(qtdZero.statusCode).toBe(400);
      expect(qtdZero.json().issues[0].message).toBe('A quantidade deve ser maior que zero');

      const custoNegativo = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-custo-neg-1',
          itens: [{ insumoId: ins.id, quantidade: 2, custoUnitario: -0.5 }],
        },
      });
      expect(custoNegativo.statusCode).toBe(400);
      expect(custoNegativo.json().issues[0].message).toBe('O custo unitário não pode ser negativo');

      const idInvalido = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-id-invalido',
          itens: [{ insumoId: 'nao-e-uuid', quantidade: 2 }],
        },
      });
      expect(idInvalido.statusCode).toBe(400);
      expect(idInvalido.json().issues[0].message).toBe('ID de insumo inválido');

      const insumoRepetido = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-insumo-repetido',
          itens: [
            { insumoId: ins.id, quantidade: 2 },
            { insumoId: ins.id, quantidade: 3 },
          ],
        },
      });
      expect(insumoRepetido.statusCode).toBe(400);
      expect(insumoRepetido.json().issues[0].code).toBe('custom');
      expect(insumoRepetido.json().issues[0].path).toEqual(['itens', 1, 'insumoId']);
      expect(insumoRepetido.json().issues[0].message).toContain('repetir o mesmo insumo');
    });
  });

  describe('POST /api/estoque/entradas-manuais', () => {
    it('aborta toda a transação (404) se um dos insumos não existir, sem alterar os demais', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Papel Acoplado', unidade: 'Unidade', estoqueAtual: 50, custoUnitario: 0.3 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-abort-404',
          observacao: 'Compra parcial inválida',
          itens: [
            { insumoId: ins.id, quantidade: 100, custoUnitario: 0.35 },
            { insumoId: randomUUID(), quantidade: 10 },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Insumo(s) não encontrado(s):');
      const insumoApos = await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } });
      expect(insumoApos.estoqueAtual).toBe(50);
      expect(insumoApos.custoUnitario).toBe(0.3);
      expect(await prisma.movimentacaoEstoque.count()).toBe(0);
    });

    it('dá entrada de +24 sobre 10 → 34 e grava lote de 3 insumos com chaves <chave>:<insumoId>', async () => {
      const i1 = await prisma.insumo.create({
        data: { nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', estoqueAtual: 10, custoUnitario: 3.0 },
      });
      const i2 = await prisma.insumo.create({
        data: { nome: 'Saco Kraft Delivery', unidade: 'Unidade', estoqueAtual: 20, custoUnitario: 0.7 },
      });
      const i3 = await prisma.insumo.create({
        data: { nome: 'Palito de madeira', unidade: 'Unidade', estoqueAtual: 100, custoUnitario: 0.1 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'nota-perdida-001',
          observacao: '   Nota perdida - Atacadão   ',
          itens: [
            { insumoId: i1.id, quantidade: 24, custoUnitario: 3.05 },
            { insumoId: i2.id, quantidade: 50 },
            { insumoId: i3.id, quantidade: 200, custoUnitario: 0 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.reaproveitado).toBe(false);
      expect(body.chaveIdempotencia).toBe('nota-perdida-001');
      expect(body.avisos).toEqual([]);
      expect(body.itens).toEqual([
        {
          insumoId: i1.id,
          nome: 'Coca Cola Zero 350ml',
          unidade: 'Unidade',
          quantidade: 24,
          saldoAnterior: 10,
          saldoPosterior: 34,
          custoUnitario: 3.05,
        },
        {
          insumoId: i2.id,
          nome: 'Saco Kraft Delivery',
          unidade: 'Unidade',
          quantidade: 50,
          saldoAnterior: 20,
          saldoPosterior: 70,
          custoUnitario: null,
        },
        {
          insumoId: i3.id,
          nome: 'Palito de madeira',
          unidade: 'Unidade',
          quantidade: 200,
          saldoAnterior: 100,
          saldoPosterior: 300,
          custoUnitario: 0,
        },
      ]);

      // Regra exata da nota fiscal: só atualiza custoUnitario do insumo quando custoUnitario > 0
      const [db1, db2, db3] = await Promise.all([
        prisma.insumo.findUniqueOrThrow({ where: { id: i1.id } }),
        prisma.insumo.findUniqueOrThrow({ where: { id: i2.id } }),
        prisma.insumo.findUniqueOrThrow({ where: { id: i3.id } }),
      ]);
      expect(db1.estoqueAtual).toBe(34);
      expect(db1.custoUnitario).toBe(3.05);
      expect(db2.estoqueAtual).toBe(70);
      expect(db2.custoUnitario).toBe(0.7);
      expect(db3.estoqueAtual).toBe(300);
      expect(db3.custoUnitario).toBe(0.1);

      const movs = await prisma.movimentacaoEstoque.findMany({ orderBy: { saldoPosterior: 'asc' } });
      expect(movs).toHaveLength(3);
      expect(movs.map((m) => m.chaveIdempotencia).sort()).toEqual([
        `nota-perdida-001:${i1.id}`,
        `nota-perdida-001:${i2.id}`,
        `nota-perdida-001:${i3.id}`,
      ].sort());
      expect(movs.every((m) => m.tipo === 'ENTRADA_MANUAL' && m.usuarioId === USER_ID)).toBe(true);
      expect(movs[0]?.observacao).toBe('Nota perdida - Atacadão');
    });

    it('retorna 200 com reaproveitado: true em replay idempotente e 409 se conteúdo diferir', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Agua sem gás', unidade: 'Unidade', estoqueAtual: 10, custoUnitario: 1.5 },
      });

      const payloadOriginal = {
        chaveIdempotencia: 'chave-replay-01',
        observacao: 'Compra balcão',
        itens: [{ insumoId: ins.id, quantidade: 12, custoUnitario: 1.6 }],
      };

      const primeira = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: payloadOriginal,
      });
      expect(primeira.statusCode).toBe(201);

      const replay = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: payloadOriginal,
      });
      expect(replay.statusCode).toBe(200);
      expect(replay.json().reaproveitado).toBe(true);
      expect(replay.json().avisos).toEqual([]);
      expect(replay.json().itens).toEqual(primeira.json().itens);

      const conflito = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-replay-01',
          observacao: 'Compra balcão',
          itens: [{ insumoId: ins.id, quantidade: 99, custoUnitario: 1.6 }],
        },
      });
      expect(conflito.statusCode).toBe(409);
      expect(conflito.json().message).toBe(
        'Já existe uma entrada manual registrada com esta chave de idempotência e conteúdo diferente',
      );

      // Erro inesperado não-EntradaManualError sobe para o error handler como 500
      vi.spyOn(EntradaManualService.prototype, 'registrarEntradaManual').mockRejectedValueOnce(
        new Error('Falha inesperada de teste'),
      );
      const erro500 = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-erro-500-01',
          itens: [{ insumoId: ins.id, quantidade: 1 }],
        },
      });
      expect(erro500.statusCode).toBe(500);

      const doBanco = await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } });
      expect(doBanco.estoqueAtual).toBe(22);
      expect(await prisma.movimentacaoEstoque.count()).toBe(1);
    });

    it('emite avisos sem bloquear quando novo custo difere > 10x do custo atual (> 0)', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Carne Bovina', unidade: 'Gramas', estoqueAtual: 1000, custoUnitario: 0.04 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/estoque/entradas-manuais',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-aviso-10x',
          itens: [{ insumoId: ins.id, quantidade: 5000, custoUnitario: 40 }], // R$/kg no lugar de R$/g
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().avisos).toHaveLength(1);
      expect(res.json().avisos[0]).toContain('Carne Bovina');
      expect(res.json().avisos[0]).toContain('10×');

      const db = await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } });
      expect(db.estoqueAtual).toBe(6000);
      expect(db.custoUnitario).toBe(40);
    });

    it('mantém soma exata em concorrência real (+5 e +8 sobre 10 → 23) e trata mesma chave simultânea como replay', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Heineken Long Neck', unidade: 'Unidade', estoqueAtual: 10, custoUnitario: 5.9 },
      });

      const [r1, r2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/estoque/entradas-manuais',
          headers: auth,
          payload: {
            chaveIdempotencia: 'conc-diff-001',
            itens: [{ insumoId: ins.id, quantidade: 5 }],
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/estoque/entradas-manuais',
          headers: auth,
          payload: {
            chaveIdempotencia: 'conc-diff-002',
            itens: [{ insumoId: ins.id, quantidade: 8 }],
          },
        }),
      ]);

      expect(r1.statusCode).toBe(201);
      expect(r2.statusCode).toBe(201);

      const insPos = await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } });
      expect(insPos.estoqueAtual).toBe(23);

      const movs = await prisma.movimentacaoEstoque.findMany({
        where: { insumoId: ins.id },
        orderBy: { saldoPosterior: 'asc' },
      });
      expect(movs).toHaveLength(2);
      expect(movs[0]?.saldoAnterior).toBe(10);
      expect(movs[1]?.saldoAnterior).toBe(movs[0]?.saldoPosterior);
      expect(movs[1]?.saldoPosterior).toBe(23);

      // Agora duas requisições simultâneas com a MESMA chave sobre o saldo 23 -> deve somar +4 apenas uma vez (= 27)
      const payloadMesmaChave = {
        chaveIdempotencia: 'conc-same-001',
        itens: [{ insumoId: ins.id, quantidade: 4 }],
      };
      const [m1, m2] = await Promise.all([
        app.inject({ method: 'POST', url: '/api/estoque/entradas-manuais', headers: auth, payload: payloadMesmaChave }),
        app.inject({ method: 'POST', url: '/api/estoque/entradas-manuais', headers: auth, payload: payloadMesmaChave }),
      ]);

      const statuses = [m1.statusCode, m2.statusCode].sort();
      expect(statuses).toEqual([200, 201]);
      expect([m1.json().reaproveitado, m2.json().reaproveitado].sort()).toEqual([false, true]);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(27);
    });
  });

  describe('GET /api/estoque/movimentacoes', () => {
    it('lista histórico paginado, mais novos primeiro, filtrado por insumoId e com usuario nulo se removido', async () => {
      const insA = await prisma.insumo.create({ data: { nome: 'Insumo A', unidade: 'Unidade', estoqueAtual: 20 } });
      const insB = await prisma.insumo.create({ data: { nome: 'Insumo B', unidade: 'Gramas', estoqueAtual: 500 } });

      const userTemp = await prisma.usuario.create({
        data: { nome: 'Temp User', email: 'temp-mov@test.local', senha: 'hash', role: 'OPERADOR' },
      });

      const t1 = new Date('2026-11-15T10:00:00Z');
      const t2 = new Date('2026-11-15T11:00:00Z');
      const t3 = new Date('2026-11-15T12:00:00Z');

      await prisma.movimentacaoEstoque.createMany({
        data: [
          {
            insumoId: insA.id,
            usuarioId: USER_ID,
            tipo: 'ENTRADA_MANUAL',
            quantidade: 5,
            saldoAnterior: 10,
            saldoPosterior: 15,
            criadoEm: t1,
          },
          {
            insumoId: insB.id,
            usuarioId: userTemp.id,
            tipo: 'ENTRADA_MANUAL',
            quantidade: 500,
            saldoAnterior: 0,
            saldoPosterior: 500,
            custoUnitario: 0.05,
            observacao: 'Compra feira',
            criadoEm: t2,
          },
          {
            insumoId: insA.id,
            usuarioId: USER_ID,
            tipo: 'ENTRADA_MANUAL',
            quantidade: 5,
            saldoAnterior: 15,
            saldoPosterior: 20,
            criadoEm: t3,
          },
        ],
      });

      await prisma.usuario.delete({ where: { id: userTemp.id } });

      // Lista paginada sem filtro
      const pag1 = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes?limite=2&offset=0',
        headers: auth,
      });
      expect(pag1.statusCode).toBe(200);
      expect(pag1.json().total).toBe(3);
      expect(pag1.json().limite).toBe(2);
      expect(pag1.json().offset).toBe(0);
      expect(pag1.json().movimentacoes).toHaveLength(2);
      expect(pag1.json().movimentacoes[0].insumo).toEqual({ id: insA.id, nome: 'Insumo A', unidade: 'Unidade' });
      expect(pag1.json().movimentacoes[0].usuario).toEqual({ id: USER_ID, nome: 'Carlos Eduardo' });
      expect(pag1.json().movimentacoes[0].saldoPosterior).toBe(20); // t3 mais novo
      expect(pag1.json().movimentacoes[1].usuario).toBeNull(); // t2 usuário apagado

      // Filtro por insumoId + offset
      const filtrado = await app.inject({
        method: 'GET',
        url: `/api/estoque/movimentacoes?insumoId=${insA.id}&limite=10&offset=1`,
        headers: auth,
      });
      expect(filtrado.statusCode).toBe(200);
      expect(filtrado.json().total).toBe(2);
      expect(filtrado.json().movimentacoes).toHaveLength(1);
      expect(filtrado.json().movimentacoes[0].saldoPosterior).toBe(15); // t1

      // Sem query params aplica defaults (limite=50, offset=0)
      const padrao = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes',
        headers: auth,
      });
      expect(padrao.statusCode).toBe(200);
      expect(padrao.json().limite).toBe(50);
      expect(padrao.json().offset).toBe(0);
      expect(padrao.json().total).toBe(3);

      // Query inválida -> 400
      const invalido = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes?limite=999',
        headers: auth,
      });
      expect(invalido.statusCode).toBe(400);

      const insumoIdInvalido = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes?insumoId=invalido',
        headers: auth,
      });
      expect(insumoIdInvalido.statusCode).toBe(400);
      expect(insumoIdInvalido.json().issues[0].message).toBe('ID de insumo inválido');

      const offsetNegativo = await app.inject({
        method: 'GET',
        url: '/api/estoque/movimentacoes?offset=-1',
        headers: auth,
      });
      expect(offsetNegativo.statusCode).toBe(400);
    });
  });
});
