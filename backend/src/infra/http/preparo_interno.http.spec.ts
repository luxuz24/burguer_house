import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';

const token = () => app.jwt.sign({ sub: 'u1', email: 'admin@bh.com', role: 'ADMIN', tv: 0 });
const auth = () => ({ authorization: `Bearer ${token()}` });

describe('Preparo Interno HTTP API', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1' },
      update: { role: 'ADMIN', ativo: true, tokenVersion: 0 },
      create: {
        id: 'u1',
        nome: 'Admin Teste',
        email: 'admin@bh.com',
        senha: 'hash',
        role: 'ADMIN',
        ativo: true,
        tokenVersion: 0,
      },
    });
  });

  beforeEach(async () => {
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('POST /api/preparo-interno/sub-fichas', () => {
    it('exige autenticação (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        payload: { insumoBeneficiadoId: 'a0000000-0000-4000-8000-000000000001', insumoBrutoId: 'a0000000-0000-4000-8000-000000000002', quantidadeNecessaria: 1 },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejeita payload inválido ou quantidade não positiva (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: { insumoBeneficiadoId: 'invalido', insumoBrutoId: 'invalido', quantidadeNecessaria: -5 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().issues).toBeDefined();
    });

    it('rejeita auto-referência beneficiado === bruto (400)', async () => {
      const sameId = 'a0000000-0000-4000-8000-000000000001';
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: { insumoBeneficiadoId: sameId, insumoBrutoId: sameId, quantidadeNecessaria: 1 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().issues[0].message).toContain('próprio beneficiado');
    });

    it('retorna 404 se o insumo beneficiado não existir', async () => {
      const bruto = await prisma.insumo.create({
        data: { nome: 'Óleo', unidade: 'Mililitros', estoqueAtual: 1000 },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: {
          insumoBeneficiadoId: 'a0000000-0000-4000-8000-000000000001',
          insumoBrutoId: bruto.id,
          quantidadeNecessaria: 0.5,
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Insumo beneficiado não encontrado');
    });

    it('retorna 404 se o insumo bruto não existir', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Maionese', unidade: 'Gramas', estoqueAtual: 0, produzidoInternamente: true },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: {
          insumoBeneficiadoId: beneficiado.id,
          insumoBrutoId: 'a0000000-0000-4000-8000-000000000002',
          quantidadeNecessaria: 0.5,
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Insumo bruto não encontrado');
    });

    it('retorna 400 se o beneficiado não tiver a flag produzidoInternamente', async () => {
      const bruto = await prisma.insumo.create({
        data: { nome: 'Sal', unidade: 'Gramas', estoqueAtual: 500 },
      });
      const naoBeneficiado = await prisma.insumo.create({
        data: { nome: 'Alface', unidade: 'Gramas', estoqueAtual: 100, produzidoInternamente: false },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: {
          insumoBeneficiadoId: naoBeneficiado.id,
          insumoBrutoId: bruto.id,
          quantidadeNecessaria: 0.1,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain('produzido internamente');
    });

    it('vincula com sucesso (201) e atualiza por upsert se enviado novamente', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Maionese Caseira', unidade: 'Gramas', estoqueAtual: 0, produzidoInternamente: true },
      });
      const bruto = await prisma.insumo.create({
        data: { nome: 'Óleo', unidade: 'Mililitros', estoqueAtual: 1000 },
      });

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: bruto.id, quantidadeNecessaria: 0.6 },
      });
      expect(res1.statusCode).toBe(201);
      expect(res1.json().quantidadeNecessaria).toBe(0.6);

      // Upsert: atualiza para 0.8
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/sub-fichas',
        headers: auth(),
        payload: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: bruto.id, quantidadeNecessaria: 0.8 },
      });
      expect(res2.statusCode).toBe(201);
      expect(res2.json().quantidadeNecessaria).toBe(0.8);
    });
  });

  describe('GET /api/preparo-interno/sub-fichas/:insumoBeneficiadoId', () => {
    it('lista ingredientes cadastrados da sub-ficha (200)', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Molho Verde', unidade: 'Gramas', estoqueAtual: 0, produzidoInternamente: true },
      });
      const bruto = await prisma.insumo.create({
        data: { nome: 'Cebolinha', unidade: 'Gramas', estoqueAtual: 200 },
      });
      await prisma.subFichaTecnica.create({
        data: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: bruto.id, quantidadeNecessaria: 0.05 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/preparo-interno/sub-fichas/${beneficiado.id}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBe(1);
      expect(res.json()[0].insumoBruto.nome).toBe('Cebolinha');
    });

    it('rejeita parâmetro que não seja UUID (400)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/preparo-interno/sub-fichas/nao-uuid',
        headers: auth(),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/preparo-interno/sub-fichas/:id', () => {
    it('remove ingrediente da sub-ficha com sucesso (204)', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Maionese', unidade: 'Gramas', estoqueAtual: 0, produzidoInternamente: true },
      });
      const bruto = await prisma.insumo.create({
        data: { nome: 'Óleo', unidade: 'Mililitros', estoqueAtual: 1000 },
      });
      const item = await prisma.subFichaTecnica.create({
        data: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: bruto.id, quantidadeNecessaria: 0.6 },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/preparo-interno/sub-fichas/${item.id}`,
        headers: auth(),
      });
      expect(res.statusCode).toBe(204);
    });

    it('retorna 404 se a sub-ficha não existir', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/preparo-interno/sub-fichas/a0000000-0000-4000-8000-000000000000',
        headers: auth(),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Ingrediente da sub-ficha não encontrado');
    });
  });

  describe('POST /api/preparo-interno/produzir', () => {
    it('produz beneficiado com sucesso (200), abater brutos e incrementa estoque', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Maionese Lote', unidade: 'Gramas', estoqueAtual: 100, produzidoInternamente: true, validadeDias: 3 },
      });
      const oleo = await prisma.insumo.create({
        data: { nome: 'Óleo Lote', unidade: 'Mililitros', estoqueAtual: 1000, fatorPerda: 0 },
      });
      await prisma.subFichaTecnica.create({
        data: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: oleo.id, quantidadeNecessaria: 0.5 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/produzir',
        headers: auth(),
        payload: { insumoBeneficiadoId: beneficiado.id, quantidade: 200 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().quantidadeProduzida).toBe(200);
      expect(res.json().insumo.estoqueAtual).toBe(300); // 100 + 200
      expect(res.json().validadeEm).toBeDefined();

      const oleoDb = await prisma.insumo.findUniqueOrThrow({ where: { id: oleo.id } });
      expect(oleoDb.estoqueAtual).toBe(900); // 1000 - (0.5 * 200)
    });

    it('rejeita com 409 quando não há estoque suficiente de bruto', async () => {
      const beneficiado = await prisma.insumo.create({
        data: { nome: 'Maionese Falta', unidade: 'Gramas', estoqueAtual: 0, produzidoInternamente: true },
      });
      const oleo = await prisma.insumo.create({
        data: { nome: 'Óleo Pouco', unidade: 'Mililitros', estoqueAtual: 10 },
      });
      await prisma.subFichaTecnica.create({
        data: { insumoBeneficiadoId: beneficiado.id, insumoBrutoId: oleo.id, quantidadeNecessaria: 0.5 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/produzir',
        headers: auth(),
        payload: { insumoBeneficiadoId: beneficiado.id, quantidade: 500 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().message).toContain('Estoque insuficiente');
    });

    it('rejeita quantidade inválida com 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/preparo-interno/produzir',
        headers: auth(),
        payload: { insumoBeneficiadoId: 'a0000000-0000-4000-8000-000000000001', quantidade: -10 },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
