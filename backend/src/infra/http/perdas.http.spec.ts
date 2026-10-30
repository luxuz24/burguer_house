import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { obterAnoEMesLoja } from '../../shared/datas.js';

const token = () => app.jwt.sign({ sub: 'u1', email: 'admin@bh.com', role: 'ADMIN', tv: 0 });
const auth = () => ({ authorization: `Bearer ${token()}` });

describe('Perdas HTTP API', () => {
  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: 'u1' },
      update: { ativo: true, tokenVersion: 0 },
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
    await prisma.perda.deleteMany().catch(() => {});
    await prisma.subFichaTecnica.deleteMany().catch(() => {});
    await prisma.fichaTecnica.deleteMany().catch(() => {});
    await prisma.insumo.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect().catch(() => {});
  });

  describe('POST /api/perdas', () => {
    it('exige autenticação (401)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        payload: { insumoId: 'a0000000-0000-4000-8000-000000000001', quantidade: 50, motivo: 'VENCIMENTO' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('registra perda com sucesso (201) e abate do estoque', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Pão de Hambúrguer', unidade: 'Unidade', estoqueAtual: 100, custoUnitario: 1.5 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        headers: auth(),
        payload: { insumoId: insumo.id, quantidade: 10, motivo: 'ESTRAGADO' },
      });

      expect(res.statusCode).toBe(201);
      const json = res.json();
      expect(json.quantidade).toBe(10);
      expect(json.motivo).toBe('ESTRAGADO');
      expect(json.estoqueNegativo).toBe(false);
      expect(json.insumo.nome).toBe('Pão de Hambúrguer');

      const insumoDb = await prisma.insumo.findUniqueOrThrow({ where: { id: insumo.id } });
      expect(insumoDb.estoqueAtual).toBe(90);
    });

    it('retorna 404 se o insumo não for encontrado', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        headers: auth(),
        payload: { insumoId: 'a0000000-0000-4000-8000-000000000001', quantidade: 10, motivo: 'VENCIMENTO' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().message).toContain('Insumo não encontrado');
    });

    it('rejeita quantidade menor ou igual a zero (400)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Tomate', unidade: 'Gramas', estoqueAtual: 500 },
      });

      const resZero = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        headers: auth(),
        payload: { insumoId: insumo.id, quantidade: 0, motivo: 'ERRO_PREPARO' },
      });
      expect(resZero.statusCode).toBe(400);

      const resNeg = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        headers: auth(),
        payload: { insumoId: insumo.id, quantidade: -5, motivo: 'ERRO_PREPARO' },
      });
      expect(resNeg.statusCode).toBe(400);
    });

    it('rejeita motivo inválido (400)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Cheddar', unidade: 'Gramas', estoqueAtual: 200 },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/perdas',
        headers: auth(),
        payload: { insumoId: insumo.id, quantidade: 50, motivo: 'MOTIVO_INVENTADO' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/perdas', () => {
    it('lista perdas recentes respeitando o limite (200)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Bacon', unidade: 'Gramas', estoqueAtual: 500 },
      });

      await prisma.perda.create({ data: { insumoId: insumo.id, quantidade: 100, motivo: 'ESTRAGADO' } });
      await prisma.perda.create({ data: { insumoId: insumo.id, quantidade: 50, motivo: 'ERRO_PREPARO' } });

      const res = await app.inject({
        method: 'GET',
        url: '/api/perdas?limite=1',
        headers: auth(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().length).toBe(1);
    });

    it('rejeita limite inválido maior que 200 (400)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/perdas?limite=500',
        headers: auth(),
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/perdas/resumo-mensal', () => {
    it('retorna agrupamento por motivo com ocorrencias e valorTotal no fuso de MS (200)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Alface Americana', unidade: 'Gramas', estoqueAtual: 500, custoUnitario: 0.02 },
      });

      await prisma.perda.create({ data: { insumoId: insumo.id, quantidade: 100, motivo: 'VENCIMENTO', custoUnitario: 0.02 } });
      await prisma.perda.create({ data: { insumoId: insumo.id, quantidade: 50, motivo: 'VENCIMENTO', custoUnitario: 0.02 } });

      const { ano, mes } = obterAnoEMesLoja();
      const res = await app.inject({
        method: 'GET',
        url: `/api/perdas/resumo-mensal?ano=${ano}&mes=${mes}`,
        headers: auth(),
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ano).toBe(ano);
      expect(json.mes).toBe(mes);
      expect(json.porMotivo.length).toBe(1);
      expect(json.porMotivo[0].motivo).toBe('VENCIMENTO');
      expect(json.porMotivo[0].quantidadeTotal).toBeUndefined();
      expect(json.porMotivo[0].ocorrencias).toBe(2);
      expect(json.porMotivo[0].valorTotal).toBe(3); // 150 * 0.02 = 3.00
      expect(json.porMotivo[0].perdasSemCusto).toBe(0);

      // Sem parâmetros, assume ano e mês vigentes da loja (MS)
      const resPadrao = await app.inject({
        method: 'GET',
        url: '/api/perdas/resumo-mensal',
        headers: auth(),
      });
      expect(resPadrao.statusCode).toBe(200);
      expect(resPadrao.json().ano).toBe(ano);
      expect(resPadrao.json().mes).toBe(mes);
    });

    it('indica perdasSemCusto quando houver perdas com custo zero (200)', async () => {
      const insumo = await prisma.insumo.create({
        data: { nome: 'Molho Zero Custo', unidade: 'Mililitros', estoqueAtual: 500, custoUnitario: 0 },
      });

      await prisma.perda.create({ data: { insumoId: insumo.id, quantidade: 100, motivo: 'ESTRAGADO', custoUnitario: 0 } });

      const res = await app.inject({
        method: 'GET',
        url: '/api/perdas/resumo-mensal',
        headers: auth(),
      });

      expect(res.statusCode).toBe(200);
      const estragado = res.json().porMotivo.find((m: any) => m.motivo === 'ESTRAGADO');
      expect(estragado).toBeDefined();
      expect(estragado.valorTotal).toBe(0);
      expect(estragado.perdasSemCusto).toBe(1);
    });

    it('rejeita mês inválido menor que 1 ou maior que 12 (400)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/perdas/resumo-mensal?mes=13',
        headers: auth(),
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
