import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

let auth: { authorization: string };

async function limpar() {
  await prisma.venda.deleteMany().catch(() => {});
  await prisma.fichaTecnica.deleteMany().catch(() => {});
  await prisma.produto.deleteMany().catch(() => {});
  await prisma.insumo.deleteMany().catch(() => {});
}

describe('API HTTP: autenticação, segredos e tratamento de erros', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1' },
      update: { ativo: true, tokenVersion: 0 },
      create: {
        id: 'u1',
        nome: 'Operador Teste',
        email: 'u1@app-spec.test',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    auth = { authorization: `Bearer ${app.jwt.sign({ sub: 'u1', email: 'u1@app-spec.test', role: 'OPERADOR', tv: 0 })}` };
  });

  beforeEach(limpar);

  afterAll(async () => {
    await limpar();
    await prisma.usuario.deleteMany({ where: { id: 'u1' } }).catch(() => {});
    vi.unstubAllEnvs();
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('JWT global', () => {
    it('rotas de domínio retornam 401 sem token ou com token inválido', async () => {
      for (const url of ['/api/insumos', '/api/produtos', '/api/dashboard/resumo', '/api/notas-fiscais', '/api/perdas']) {
        const r = await app.inject({ method: 'GET', url });
        expect(r.statusCode, url).toBe(401);
      }
      const invalido = await app.inject({ method: 'GET', url: '/api/insumos', headers: { authorization: 'Bearer lixo' } });
      expect(invalido.statusCode).toBe(401);
    });

    it('com token válido acessa; /health é público; preflight CORS não exige token', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/insumos', headers: auth })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/api/insumos',
        headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET' },
      });
      expect(preflight.statusCode).toBe(204);
    });

    it('login não exige token (e URL com barra final/query não burla o guard em rota protegida)', async () => {
      const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
      expect(login.statusCode).toBe(400);
      const burla = await app.inject({ method: 'GET', url: '/api/insumos/?x=/health' });
      expect(burla.statusCode).toBe(401);
    });
  });

  describe('webhook Anota AI', () => {
    const payload = { items: [{ name: 'X', quantity: 1 }] };

    it('503 sem segredo configurado, 401 com segredo errado, 200 e grava com segredo correto (header ou ?token=)', async () => {
      vi.stubEnv('ANOTAAI_WEBHOOK_SECRET', '');
      expect((await app.inject({ method: 'POST', url: '/api/webhook/anota-ai', payload })).statusCode).toBe(503);

      vi.stubEnv('ANOTAAI_WEBHOOK_SECRET', 'segredo-do-webhook');
      const errado = await app.inject({
        method: 'POST', url: '/api/webhook/anota-ai', payload, headers: { 'x-webhook-secret': 'outro' },
      });
      expect(errado.statusCode).toBe(401);
      expect(await prisma.venda.count()).toBe(0);

      const header = await app.inject({
        method: 'POST', url: '/api/webhook/anota-ai', payload, headers: { 'x-webhook-secret': 'segredo-do-webhook' },
      });
      expect(header.statusCode).toBe(200);
      const query = await app.inject({ method: 'POST', url: '/api/webhook/anota-ai?token=segredo-do-webhook', payload });
      expect(query.statusCode).toBe(200);
      expect(await prisma.venda.count()).toBe(2);
    });

    it('deduplica reenvios do mesmo pedido (via id no payload ou header x-webhook-id) sem duplicar venda no banco', async () => {
      vi.stubEnv('ANOTAAI_WEBHOOK_SECRET', 'segredo-do-webhook');
      const pedidoComId = { id: 'anotaai-order-999', items: [{ name: 'X-Burger', quantity: 2 }] };

      const primeira = await app.inject({
        method: 'POST',
        url: '/api/webhook/anota-ai',
        payload: pedidoComId,
        headers: { 'x-webhook-secret': 'segredo-do-webhook' },
      });
      expect(primeira.statusCode).toBe(200);
      expect(primeira.json()).toEqual({ received: true });

      const reenvio = await app.inject({
        method: 'POST',
        url: '/api/webhook/anota-ai',
        payload: pedidoComId,
        headers: { 'x-webhook-secret': 'segredo-do-webhook' },
      });
      expect(reenvio.statusCode).toBe(200);
      expect(reenvio.json()).toEqual({ received: true, duplicate: true });
      expect(await prisma.venda.count()).toBe(1);
    });
  });

  describe('consolidação (cron)', () => {
    it('503 sem CRON_SECRET, 401 com segredo errado ou só JWT, 200 com o segredo', async () => {
      vi.stubEnv('CRON_SECRET', '');
      expect((await app.inject({ method: 'POST', url: '/api/vendas/consolidar' })).statusCode).toBe(503);

      vi.stubEnv('CRON_SECRET', 'segredo-do-cron');
      expect((await app.inject({ method: 'POST', url: '/api/vendas/consolidar', headers: { 'x-cron-secret': 'x' } })).statusCode).toBe(401);
      expect((await app.inject({ method: 'POST', url: '/api/vendas/consolidar', headers: auth })).statusCode).toBe(401);

      const ok = await app.inject({ method: 'POST', url: '/api/vendas/consolidar', headers: { 'x-cron-secret': 'segredo-do-cron' } });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ consolidadas: 0 });
    });
  });

  describe('validação e erros (Zod + handler central)', () => {
    it('400 com issues para insumo inválido e para ID que não é UUID', async () => {
      const invalido = await app.inject({
        method: 'POST', url: '/api/insumos', headers: auth, payload: { nome: '', unidade: 'g', estoqueAtual: 'abc' },
      });
      expect(invalido.statusCode).toBe(400);
      expect(invalido.json().issues.length).toBeGreaterThan(0);

      expect((await app.inject({ method: 'DELETE', url: '/api/insumos/nao-e-uuid', headers: auth })).statusCode).toBe(400);
    });

    it('ignora campos extras (sem mass assignment) e aplica defaults', async () => {
      const r = await app.inject({
        method: 'POST', url: '/api/insumos', headers: auth,
        payload: { nome: 'Pão', unidade: 'Unidade', id: '00000000-0000-0000-0000-000000000001', criadoEm: '2000-01-01' },
      });
      expect(r.statusCode).toBe(201);
      expect(r.json().id).not.toBe('00000000-0000-0000-0000-000000000001');
      expect(r.json()).toMatchObject({ estoqueAtual: 0, estoqueMinimo: 0, fatorPerda: 0 });
    });

    it('404 ao atualizar/remover id inexistente; atualização parcial não zera os outros campos', async () => {
      const inexistente = '00000000-0000-0000-0000-000000000000';
      expect((await app.inject({ method: 'PUT', url: `/api/insumos/${inexistente}`, headers: auth, payload: { nome: 'X' } })).statusCode).toBe(404);
      expect((await app.inject({ method: 'DELETE', url: `/api/insumos/${inexistente}`, headers: auth })).statusCode).toBe(404);

      const criado = await prisma.insumo.create({
        data: { nome: 'Carne', unidade: 'Gramas', fatorPerda: 0.1, estoqueAtual: 500, estoqueMinimo: 100 },
      });
      const parcial = await app.inject({ method: 'PUT', url: `/api/insumos/${criado.id}`, headers: auth, payload: { estoqueMinimo: 120 } });
      expect(parcial.statusCode).toBe(200);
      expect(parcial.json()).toMatchObject({ nome: 'Carne', fatorPerda: 0.1, estoqueMinimo: 120, estoqueAtual: 500 });
    });

    it('409 ao remover insumo em uso por uma ficha técnica e ao duplicar ficha', async () => {
      const insumo = await prisma.insumo.create({ data: { nome: 'Queijo', unidade: 'Unidade', fatorPerda: 0, estoqueAtual: 10, estoqueMinimo: 1 } });
      const produto = await prisma.produto.create({ data: { nome: 'X-Queijo' } });
      const ficha = { produtoId: produto.id, insumoId: insumo.id, quantidade: 2 };

      const criada = await app.inject({ method: 'POST', url: '/api/fichas-tecnicas', headers: auth, payload: ficha });
      expect(criada.statusCode).toBe(201);
      expect((await app.inject({ method: 'POST', url: '/api/fichas-tecnicas', headers: auth, payload: ficha })).statusCode).toBe(409);
      const atualizada = await app.inject({ method: 'PUT', url: `/api/fichas-tecnicas/${criada.json().id}`, headers: auth, payload: { quantidade: 5 } });
      expect(atualizada.statusCode).toBe(200);
      expect(atualizada.json().quantidade).toBe(5);
      expect((await app.inject({ method: 'DELETE', url: `/api/insumos/${insumo.id}`, headers: auth })).statusCode).toBe(409);
      expect((await app.inject({ method: 'POST', url: '/api/fichas-tecnicas', headers: auth, payload: { ...ficha, quantidade: -1 } })).statusCode).toBe(400);
    });

    it('JSON malformado vira 400 (e não 500)', async () => {
      const r = await app.inject({
        method: 'POST', url: '/api/produtos', headers: { ...auth, 'content-type': 'application/json' }, payload: '{nome:',
      });
      expect(r.statusCode).toBe(400);
    });

    it('rejeita XML acima de 500 KB e janela de datas inválida ou > 366 dias no dashboard com 400', async () => {
      const xmlGigante = '<NFe>' + 'a'.repeat(512_001) + '</NFe>';
      const resXml = await app.inject({
        method: 'POST',
        url: '/api/notas-fiscais/parser-xml',
        headers: auth,
        payload: { xml: xmlGigante },
      });
      expect(resXml.statusCode).toBe(400);

      const resInvertido = await app.inject({
        method: 'GET',
        url: '/api/dashboard/resumo?dataInicio=2026-10-10&dataFim=2026-10-01',
        headers: auth,
      });
      expect(resInvertido.statusCode).toBe(400);

      const resJanelaLonga = await app.inject({
        method: 'GET',
        url: '/api/dashboard/resumo?dataInicio=2024-01-01&dataFim=2026-01-01',
        headers: auth,
      });
      expect(resJanelaLonga.statusCode).toBe(400);
    });
  });

  // Por último: o limitador é compartilhado pelo mesmo IP durante o arquivo.
  describe('rate limit do login', () => {
    it('responde 429 com Retry-After após 10 tentativas', async () => {
      let ultimo = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@x.com', senha: 'x' } });
      for (let i = 0; i < 11; i++) {
        ultimo = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@x.com', senha: 'x' } });
      }
      expect(ultimo.statusCode).toBe(429);
      expect(Number(ultimo.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
