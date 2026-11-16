import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { app } from './app.js';
import { prisma } from '../database/prisma.js';
import { FechamentoManualService } from '../../modules/vendas/services/fechamento_manual.service.js';
import { EstornarFechamentoService } from '../../modules/vendas/services/estornar_fechamento.service.js';
import { ListarFechamentosManuaisService } from '../../modules/vendas/services/listar_fechamentos_manuais.service.js';

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

describe('Listagem de Fechamentos Manuais HTTP API (GET /api/vendas/fechamentos-manuais)', () => {
  let auth: Record<string, string>;
  const usuarioId = 'user-listagem-http';
  const fechamentoService = new FechamentoManualService();
  const estornoService = new EstornarFechamentoService();

  beforeAll(async () => {
    await app.ready();
    await prisma.usuario.upsert({
      where: { id: usuarioId },
      update: { ativo: true, tokenVersion: 0, nome: 'Carlos Listagem' },
      create: {
        id: usuarioId,
        nome: 'Carlos Listagem',
        email: 'listagem.http@teste.com',
        senha: 'hash',
        role: 'OPERADOR',
        ativo: true,
        tokenVersion: 0,
      },
    });
    const token = app.jwt.sign({
      sub: usuarioId,
      email: 'listagem.http@teste.com',
      role: 'OPERADOR',
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

  it('exige JWT (401) e rejeita data inválida (400)', async () => {
    const semToken = await app.inject({
      method: 'GET',
      url: '/api/vendas/fechamentos-manuais',
    });
    expect(semToken.statusCode).toBe(401);

    const dataInvalida = await app.inject({
      method: 'GET',
      url: '/api/vendas/fechamentos-manuais?data=2026-02-31',
      headers: auth,
    });
    expect(dataInvalida.statusCode).toBe(400);
    expect(dataInvalida.json().message).toBe('Data inválida; use o formato AAAA-MM-DD');

    const dataVazia = await app.inject({
      method: 'GET',
      url: '/api/vendas/fechamentos-manuais?data=',
      headers: auth,
    });
    expect(dataVazia.statusCode).toBe(400);
  });

  it('lista fechamentos do dia ordenado do mais novo para o mais antigo sem vazar _fechamento', async () => {
    const pao = await prisma.insumo.create({
      data: { nome: 'Pão HTTP List', unidade: 'Unidade', estoqueAtual: 50 },
    });
    const prod = await prisma.produto.create({
      data: {
        nome: 'BACON HOUSE',
        fichasTecnicas: { create: [{ insumoId: pao.id, quantidade: 1 }] },
      },
    });

    const f1 = await fechamentoService.confirmar({
      chaveIdempotencia: 'http-list-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 1 }],
      usuarioId,
    });
    await estornoService.executar({
      vendaId: f1.vendaId,
      motivo: 'Corrigido',
      usuarioId,
    });

    const f2 = await fechamentoService.confirmar({
      chaveIdempotencia: 'http-list-02',
      data: '2026-11-13',
      observacao: 'Turno noite',
      itens: [{ produtoId: prod.id, quantidade: 3 }],
      usuarioId,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/vendas/fechamentos-manuais?data=2026-11-13',
      headers: auth,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBe('2026-11-13');
    expect(body.total).toBe(2);
    expect(body.fechamentos[0]).toEqual({
      id: f2.vendaId,
      externalId: 'manual:http-list-02',
      criadoEm: expect.any(String),
      ocorridoEm: '2026-11-13T16:00:00.000Z',
      observacao: 'Turno noite',
      itens: [{ nome: 'BACON HOUSE', quantidade: 3 }],
      usuario: { id: usuarioId, nome: 'Carlos Listagem' },
      estornada: false,
      estorno: null,
    });
    expect(body.fechamentos[1]).toMatchObject({
      id: f1.vendaId,
      estornada: true,
      estorno: {
        motivo: 'Corrigido',
        usuario: { id: usuarioId, nome: 'Carlos Listagem' },
      },
    });
  });

  it('usa data padrão de hoje quando omitida e retorna 500 genérico em erro inesperado', async () => {
    const hoje = await app.inject({
      method: 'GET',
      url: '/api/vendas/fechamentos-manuais',
      headers: auth,
    });
    expect(hoje.statusCode).toBe(200);
    expect(hoje.json().total).toBe(0);
    expect(hoje.json().data).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const spy = vi
      .spyOn(ListarFechamentosManuaisService.prototype, 'listar')
      .mockRejectedValueOnce(new Error('Falha inesperada'));
    try {
      const erro500 = await app.inject({
        method: 'GET',
        url: '/api/vendas/fechamentos-manuais',
        headers: auth,
      });
      expect(erro500.statusCode).toBe(500);
      expect(erro500.json()).toEqual({ message: 'Erro interno no servidor' });
    } finally {
      spy.mockRestore();
    }
  });
});
