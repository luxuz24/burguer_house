import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { FechamentoManualService } from '../../modules/vendas/services/fechamento_manual.service.js';
import { obterIntervaloDiaLoja } from '../../shared/datas.js';

let auth: { authorization: string };
const USER_ID = 'user-fechamento-http';

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

describe('Fechamento Manual HTTP API (/api/vendas/fechamento-manual)', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: USER_ID },
      update: { ativo: true, tokenVersion: 0, nome: 'Operador Fechamento' },
      create: {
        id: USER_ID,
        nome: 'Operador Fechamento',
        email: 'fechamento@burguerhouse.test',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = {
      authorization: `Bearer ${app.jwt.sign({
        sub: USER_ID,
        email: 'fechamento@burguerhouse.test',
        role: 'OPERADOR',
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

  describe('Autenticação e validações (401 / 400)', () => {
    it('exige JWT nas rotas de simulação e confirmação (401)', async () => {
      const sim = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        payload: { itens: [{ produtoId: randomUUID(), quantidade: 1 }] },
      });
      expect(sim.statusCode).toBe(401);

      const conf = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        payload: {
          chaveIdempotencia: 'chave-sem-auth-01',
          itens: [{ produtoId: randomUUID(), quantidade: 1 }],
        },
      });
      expect(conf.statusCode).toBe(401);
    });

    it('rejeita payloads inválidos, data futura e chave ausente/curta com 400', async () => {
      const pid = randomUUID();

      const itensVazios = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: { chaveIdempotencia: 'chave-valida-01', itens: [] },
      });
      expect(itensVazios.statusCode).toBe(400);
      expect(itensVazios.json().issues[0].message).toBe('Informe ao menos um produto');

      const itensVaziosSim = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: { itens: [] },
      });
      expect(itensVaziosSim.statusCode).toBe(400);
      expect(itensVaziosSim.json().issues[0].message).toBe('Informe ao menos um produto');

      const idInvalido = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: { itens: [{ produtoId: 'nao-e-uuid', quantidade: 1 }] },
      });
      expect(idInvalido.statusCode).toBe(400);
      expect(idInvalido.json().issues[0].message).toBe('ID de produto inválido');

      const qtdDecimal = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: { itens: [{ produtoId: pid, quantidade: 1.5 }] },
      });
      expect(qtdDecimal.statusCode).toBe(400);
      expect(qtdDecimal.json().issues[0].message).toBe('A quantidade deve ser um número inteiro');

      const qtdZero = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: { chaveIdempotencia: 'chave-valida-02', itens: [{ produtoId: pid, quantidade: 0 }] },
      });
      expect(qtdZero.statusCode).toBe(400);
      expect(qtdZero.json().issues[0].message).toBe('A quantidade deve ser no mínimo 1');

      const qtdAcima500 = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: { itens: [{ produtoId: pid, quantidade: 501 }] },
      });
      expect(qtdAcima500.statusCode).toBe(400);
      expect(qtdAcima500.json().issues[0].message).toBe('A quantidade máxima por item é 500');

      const acima100Itens = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-valida-03',
          itens: Array.from({ length: 101 }, () => ({ produtoId: randomUUID(), quantidade: 1 })),
        },
      });
      expect(acima100Itens.statusCode).toBe(400);
      expect(acima100Itens.json().issues[0].message).toBe('Máximo de 100 itens por fechamento');

      const acima100Sim = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: {
          itens: Array.from({ length: 101 }, () => ({ produtoId: randomUUID(), quantidade: 1 })),
        },
      });
      expect(acima100Sim.statusCode).toBe(400);
      expect(acima100Sim.json().issues[0].message).toBe('Máximo de 100 itens por fechamento');

      const dataFutura = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-valida-04',
          data: '2099-12-31',
          itens: [{ produtoId: pid, quantidade: 1 }],
        },
      });
      expect(dataFutura.statusCode).toBe(400);
      expect(dataFutura.json().message).toBe('A data não pode ser futura');

      const semChave = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: { itens: [{ produtoId: pid, quantidade: 1 }] },
      });
      expect(semChave.statusCode).toBe(400);

      const chaveCurta = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: '   curta   ',
          itens: [{ produtoId: pid, quantidade: 1 }],
        },
      });
      expect(chaveCurta.statusCode).toBe(400);
      expect(chaveCurta.json().issues[0].message).toBe('A chave de idempotência deve ter no mínimo 8 caracteres');

      const chaveLonga = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'x'.repeat(101),
          itens: [{ produtoId: pid, quantidade: 1 }],
        },
      });
      expect(chaveLonga.statusCode).toBe(400);
      expect(chaveLonga.json().issues[0].message).toBe('A chave de idempotência deve ter no máximo 100 caracteres');

      const obsLonga = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-valida-obs-longa',
          observacao: 'a'.repeat(501),
          itens: [{ produtoId: pid, quantidade: 1 }],
        },
      });
      expect(obsLonga.statusCode).toBe(400);
      expect(obsLonga.json().issues[0].message).toBe('A observação deve ter no máximo 500 caracteres');

      const obsTrimLimite = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'chave-valida-obs-trim',
          observacao: `  ${'a'.repeat(500)}  `,
          itens: [{ produtoId: pid, quantidade: 1 }],
        },
      });
      expect(obsTrimLimite.statusCode).toBe(422);
    });
  });

  describe('Simulação (POST /api/vendas/fechamento-manual/simulacao)', () => {
    it('calcula consumos com fatorPerdaSeguro sem alterar o banco e sinaliza produtosSemFicha ou 422 se inexistente', async () => {
      const carne = await prisma.insumo.create({
        data: { nome: 'Carne 160g', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.1, estoqueAtual: 300 },
      });
      const burger = await prisma.produto.create({
        data: {
          nome: 'BACON HOUSE',
          fichasTecnicas: { create: [{ insumoId: carne.id, quantidade: 160 }] },
        },
      });
      const semFicha = await prisma.produto.create({ data: { nome: 'X-Tudo' } });

      // Simulação válida (inclusive deixando estoque projetado negativo: 300 - 352 = -52) + item sem ficha
      const res = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: {
          data: '2026-11-13',
          itens: [
            { produtoId: burger.id, quantidade: 2 },
            { produtoId: semFicha.id, quantidade: 1 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toBe('2026-11-13');
      expect(body.podeConfirmar).toBe(false);
      expect(body.temNegativo).toBe(true);
      expect(body.produtosSemFicha).toEqual([{ produtoId: semFicha.id, nome: 'X-Tudo' }]);
      expect(body.consumos).toEqual([
        {
          insumoId: carne.id,
          nome: 'Carne 160g',
          unidade: 'Gramas',
          categoria: 'INGREDIENTE',
          consumo: 352, // 2 * 160 * (1 + 0.1)
          estoqueAtual: 300,
          estoqueProjetado: -52,
          ficariaNegativo: true,
        },
      ]);

      // Banco idêntico antes e depois da simulação
      expect(await prisma.venda.count()).toBe(0);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(300);

      // produtoId inexistente -> 422
      const missingId = randomUUID();
      const inexistente = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: {
          data: '2026-11-13',
          itens: [{ produtoId: missingId, quantidade: 1 }],
        },
      });
      expect(inexistente.statusCode).toBe(422);
      expect(inexistente.json().produtosNaoEncontrados).toEqual([missingId]);

      // Erro inesperado -> 500
      vi.spyOn(FechamentoManualService.prototype, 'simular').mockRejectedValueOnce(new Error('Erro inesperado sim'));
      const sim500 = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual/simulacao',
        headers: auth,
        payload: { itens: [{ produtoId: burger.id, quantidade: 1 }] },
      });
      expect(sim500.statusCode).toBe(500);
    });
  });

  describe('Confirmação (POST /api/vendas/fechamento-manual)', () => {
    it('baixa 2 BACON HOUSE + 1 Coca Cola Zero 350ml (ingredientes, embalagens e bebida 1:1) e grava Venda MANUAL', async () => {
      const carne = await prisma.insumo.create({
        data: { nome: 'Blend Bovino', unidade: 'Gramas', categoria: 'INGREDIENTE', fatorPerda: 0.05, estoqueAtual: 1000 },
      });
      const papel = await prisma.insumo.create({
        data: { nome: 'Papel Acoplado', unidade: 'Unidade', categoria: 'EMBALAGEM', estoqueAtual: 1 }, // vai ficar -1
      });
      const coca = await prisma.insumo.create({
        data: { nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', categoria: 'BEBIDA', estoqueAtual: 10 },
      });

      const baconHouse = await prisma.produto.create({
        data: {
          nome: 'BACON HOUSE',
          fichasTecnicas: {
            create: [
              { insumoId: carne.id, quantidade: 160 },
              { insumoId: papel.id, quantidade: 1 },
            ],
          },
        },
      });
      const cocaProd = await prisma.produto.create({
        data: {
          nome: 'Coca Cola Zero 350ml',
          fichasTecnicas: { create: [{ insumoId: coca.id, quantidade: 1 }] },
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fechamento-2026-11-13',
          data: '2026-11-13',
          observacao: 'Movimento de sexta',
          itens: [
            { produtoId: baconHouse.id, quantidade: 2 },
            { produtoId: cocaProd.id, quantidade: 1 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.reaproveitado).toBe(false);
      expect(body.externalId).toBe('manual:fechamento-2026-11-13');
      expect(body.chaveIdempotencia).toBe('fechamento-2026-11-13');
      expect(body.data).toBe('2026-11-13');
      expect(body.ocorridoEm).toBe('2026-11-13T16:00:00.000Z'); // 12:00 em MS (UTC-4)
      expect(body.insumosComEstoqueNegativo).toEqual([
        { id: papel.id, nome: 'Papel Acoplado', estoqueAtual: -1 },
      ]);

      // 2 * 160 * 1.05 = 336g carne -> 664; 2 papel -> -1; 1 coca -> 9
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(664);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: papel.id } })).estoqueAtual).toBe(-1);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: coca.id } })).estoqueAtual).toBe(9);

      const venda = await prisma.venda.findUniqueOrThrow({ where: { id: body.vendaId } });
      expect(venda.origem).toBe('MANUAL');
      expect(venda.processado).toBe(true);
      expect(venda.registradoPorId).toBe(USER_ID);
      expect(venda.externalId).toBe('manual:fechamento-2026-11-13');
      expect(venda.ocorridoEm.toISOString()).toBe('2026-11-13T16:00:00.000Z');
      expect(venda.payloadOriginal).toEqual({
        info: {
          id: 'manual:fechamento-2026-11-13',
          check: 1,
          items: [
            { produtoId: baconHouse.id, name: 'BACON HOUSE', quantity: 2 },
            { produtoId: cocaProd.id, name: 'Coca Cola Zero 350ml', quantity: 1 },
          ],
        },
        origem: 'manual',
        data: '2026-11-13',
        observacao: 'Movimento de sexta',
        _fechamento: {
          consumos: expect.arrayContaining([
            { insumoId: carne.id, nome: 'Blend Bovino', unidade: 'Gramas', quantidade: 336 },
            { insumoId: papel.id, nome: 'Papel Acoplado', unidade: 'Unidade', quantidade: 2 },
            { insumoId: coca.id, nome: 'Coca Cola Zero 350ml', unidade: 'Unidade', quantidade: 1 },
          ]),
          insumosComEstoqueNegativo: [
            { id: papel.id, nome: 'Papel Acoplado', estoqueAtual: -1 },
          ],
        },
      });
    });

    it('retorna 200 com reaproveitado: true no replay idempotente e 409 se corpo divergir', async () => {
      const carne = await prisma.insumo.create({
        data: { nome: 'Carne Replay', unidade: 'Gramas', estoqueAtual: 500 },
      });
      const burger = await prisma.produto.create({
        data: {
          nome: 'Burger Replay',
          fichasTecnicas: { create: [{ insumoId: carne.id, quantidade: 100 }] },
        },
      });

      const payloadOriginal = {
        chaveIdempotencia: 'fech-replay-001',
        data: '2026-11-13',
        observacao: 'Caixa 1',
        itens: [{ produtoId: burger.id, quantidade: 2 }],
      };

      const primeira = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: payloadOriginal,
      });
      expect(primeira.statusCode).toBe(201);

      const replay = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: payloadOriginal,
      });
      expect(replay.statusCode).toBe(200);
      expect(replay.json().reaproveitado).toBe(true);
      expect(replay.json().vendaId).toBe(primeira.json().vendaId);
      expect(replay.json().consumos).toEqual(primeira.json().consumos);

      const conflito = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: { ...payloadOriginal, itens: [{ produtoId: burger.id, quantidade: 3 }] },
      });
      expect(conflito.statusCode).toBe(409);
      expect(conflito.json().message).toContain('conteúdo diferente');

      vi.spyOn(FechamentoManualService.prototype, 'confirmar').mockRejectedValueOnce(new Error('Erro inesperado conf'));
      const conf500 = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: { ...payloadOriginal, chaveIdempotencia: 'fech-erro-500' },
      });
      expect(conf500.statusCode).toBe(500);

      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(300);
      expect(await prisma.venda.count()).toBe(1);
    });

    it('aborta com 422 se produto inexistente estiver no meio da lista sem baixar estoque nem criar Venda', async () => {
      const ins = await prisma.insumo.create({
        data: { nome: 'Queijo', unidade: 'Gramas', estoqueAtual: 400 },
      });
      const prod = await prisma.produto.create({
        data: {
          nome: 'Cheese',
          fichasTecnicas: { create: [{ insumoId: ins.id, quantidade: 50 }] },
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fech-422-abort',
          data: '2026-11-13',
          itens: [
            { produtoId: prod.id, quantidade: 2 },
            { produtoId: randomUUID(), quantidade: 1 },
          ],
        },
      });

      expect(res.statusCode).toBe(422);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(400);
      expect(await prisma.venda.count()).toBe(0);
    });

    it('mantém saldo exato em concorrência real (chaves diferentes e mesma chave simultânea)', async () => {
      const carne = await prisma.insumo.create({
        data: { nome: 'Carne Concorrente', unidade: 'Gramas', estoqueAtual: 1000 },
      });
      const prod = await prisma.produto.create({
        data: {
          nome: 'Burger Concorrente',
          fichasTecnicas: { create: [{ insumoId: carne.id, quantidade: 160 }] },
        },
      });

      // Chaves diferentes simultâneas: 2 * 160 (=320) e 1 * 160 (=160) -> 1000 - 480 = 520
      const [c1, c2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/api/vendas/fechamento-manual',
          headers: auth,
          payload: {
            chaveIdempotencia: 'conc-fech-001',
            data: '2026-11-13',
            itens: [{ produtoId: prod.id, quantidade: 2 }],
          },
        }),
        app.inject({
          method: 'POST',
          url: '/api/vendas/fechamento-manual',
          headers: auth,
          payload: {
            chaveIdempotencia: 'conc-fech-002',
            data: '2026-11-13',
            itens: [{ produtoId: prod.id, quantidade: 1 }],
          },
        }),
      ]);
      expect(c1.statusCode).toBe(201);
      expect(c2.statusCode).toBe(201);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(520);

      // Mesma chave simultânea: baixa uma única vez (-160 -> 360)
      const payloadMesmaChave = {
        chaveIdempotencia: 'conc-fech-mesma-01',
        data: '2026-11-13',
        itens: [{ produtoId: prod.id, quantidade: 1 }],
      };
      const [m1, m2] = await Promise.all([
        app.inject({ method: 'POST', url: '/api/vendas/fechamento-manual', headers: auth, payload: payloadMesmaChave }),
        app.inject({ method: 'POST', url: '/api/vendas/fechamento-manual', headers: auth, payload: payloadMesmaChave }),
      ]);

      expect([m1.statusCode, m2.statusCode].sort()).toEqual([200, 201]);
      expect([m1.json().reaproveitado, m2.json().reaproveitado].sort()).toEqual([false, true]);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(360);
      expect(await prisma.venda.count()).toBe(3);
    });

    it('consolidar e marcar-tratadas ignoram vendas MANUAL', async () => {
      vi.stubEnv('CRON_SECRET', 'cron-secret-fech-test');
      const carne = await prisma.insumo.create({
        data: { nome: 'Carne Isolamento', unidade: 'Gramas', estoqueAtual: 500 },
      });
      const prod = await prisma.produto.create({
        data: {
          nome: 'Burger Isolamento',
          fichasTecnicas: { create: [{ insumoId: carne.id, quantidade: 100 }] },
        },
      });

      const fech = await app.inject({
        method: 'POST',
        url: '/api/vendas/fechamento-manual',
        headers: auth,
        payload: {
          chaveIdempotencia: 'fech-ignorar-cron',
          data: '2026-11-13',
          itens: [{ produtoId: prod.id, quantidade: 2 }],
        },
      });
      expect(fech.statusCode).toBe(201);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(300);

      // Consolidar não vê pendentes nem baixa novamente
      const cons = await app.inject({
        method: 'POST',
        url: '/api/vendas/consolidar',
        headers: { 'x-cron-secret': 'cron-secret-fech-test' },
      });
      expect(cons.statusCode).toBe(200);
      expect(cons.json().consolidadas).toBe(0);
      expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(300);

      // Marcar-tratadas marca apenas webhook pendente e não toca na venda MANUAL (payloadOriginal intacto sem _tratamento)
      await prisma.venda.create({
        data: {
          externalId: 'wh-pendente-1',
          origem: 'WEBHOOK',
          processado: false,
          payloadOriginal: { check: 0, items: [] },
        },
      });
      // `ate` = hoje no fuso da loja: as duas vendas (criadoEm = agora) entram no corte,
      // então a venda MANUAL só fica de fora por causa da origem, não da data.
      const { ano, mes, dia } = obterIntervaloDiaLoja();
      const hojeLoja = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const trat = await app.inject({
        method: 'POST',
        url: '/api/vendas/marcar-tratadas',
        headers: auth,
        payload: { ate: hojeLoja, motivo: 'Modo sombra teste' },
      });
      expect(trat.statusCode).toBe(200);
      expect(trat.json().marcadas).toBe(1);

      const vendaManual = await prisma.venda.findUniqueOrThrow({ where: { id: fech.json().vendaId } });
      expect((vendaManual.payloadOriginal as Record<string, unknown>)._tratamento).toBeUndefined();
      expect((vendaManual.payloadOriginal as Record<string, unknown>)._fechamento).toBeDefined();
    });
  });
});
