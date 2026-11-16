import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../infra/database/prisma.js';
import { FechamentoManualService } from './fechamento_manual.service.js';
import {
  EstornarFechamentoService,
  EstornoFechamentoError,
} from './estornar_fechamento.service.js';

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
  await prisma.usuario.deleteMany().catch(() => {});
}

describe('EstornarFechamentoService', () => {
  const fechamentoService = new FechamentoManualService();
  const estornoService = new EstornarFechamentoService();

  beforeEach(limparBanco);

  afterAll(async () => {
    await limparBanco();
    await prisma.$disconnect().catch(() => {});
  });

  it('devolve exatamente o snapshot _fechamento.consumos mesmo após alteração na ficha técnica e preserva a venda e _fechamento', async () => {
    const usuario = await prisma.usuario.create({
      data: { nome: 'Carlos Eduardo', email: 'carlos.estorno@teste.com', senha: 'hash' },
    });
    const carne = await prisma.insumo.create({
      data: { nome: 'Carne Bovina', unidade: 'Gramas', fatorPerda: 0.1, estoqueAtual: 1000 },
    });
    const papel = await prisma.insumo.create({
      data: { nome: 'Papel Acoplado', unidade: 'Unidade', estoqueAtual: 1 },
    });
    const extraNovo = await prisma.insumo.create({
      data: { nome: 'Molho Especial', unidade: 'Gramas', estoqueAtual: 500 },
    });

    const burger = await prisma.produto.create({
      data: {
        nome: 'BACON HOUSE',
        fichasTecnicas: {
          create: [
            { insumoId: carne.id, quantidade: 100 }, // 100 * 1.1 = 110 por un; 2 un = 220
            { insumoId: papel.id, quantidade: 1 }, // 2 un = 2 (papel cai para -1)
          ],
        },
      },
    });

    const fechado = await fechamentoService.confirmar({
      chaveIdempotencia: 'estorno-ficha-alterada-01',
      data: '2026-11-13',
      observacao: 'Fechamento sexta',
      itens: [{ produtoId: burger.id, quantidade: 2 }],
      usuarioId: usuario.id,
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(780);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: papel.id } })).estoqueAtual).toBe(-1);

    // Altera drasticamente a ficha técnica depois do fechamento
    await prisma.fichaTecnica.deleteMany({ where: { produtoId: burger.id } });
    await prisma.fichaTecnica.create({
      data: { produtoId: burger.id, insumoId: extraNovo.id, quantidade: 999 },
    });

    const res = await estornoService.executar({
      vendaId: fechado.vendaId,
      motivo: '  Lancei o dia errado  ',
      usuarioId: usuario.id,
    });

    expect(res.vendaId).toBe(fechado.vendaId);
    expect(res.estornada).toBe(true);
    expect(res.estorno.usuarioId).toBe(usuario.id);
    expect(res.estorno.motivo).toBe('Lancei o dia errado');
    expect(Number.isNaN(Date.parse(res.estorno.em))).toBe(false);

    // Saldos restaurados exatamente pelos valores do snapshot (não tocou em extraNovo)
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: carne.id } })).estoqueAtual).toBe(1000);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: papel.id } })).estoqueAtual).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: extraNovo.id } })).estoqueAtual).toBe(500);

    const devolucoesOrdenadas = [...res.devolucoes].sort((a, b) => a.nome.localeCompare(b.nome));
    expect(devolucoesOrdenadas).toEqual([
      { insumoId: carne.id, nome: 'Carne Bovina', unidade: 'Gramas', quantidade: 220, estoqueAtual: 1000 },
      { insumoId: papel.id, nome: 'Papel Acoplado', unidade: 'Unidade', quantidade: 2, estoqueAtual: 1 },
    ]);

    // Venda continua no banco com processado = true, _fechamento intacto e _estorno gravado
    const vendaDb = await prisma.venda.findUniqueOrThrow({ where: { id: fechado.vendaId } });
    expect(vendaDb.processado).toBe(true);
    const payload = vendaDb.payloadOriginal as Record<string, unknown>;
    expect(payload._fechamento).toBeDefined();
    expect(payload.observacao).toBe('Fechamento sexta');
    expect(payload._estorno).toEqual(res.estorno);
  });

  it('rejeita motivo vazio (400), venda inexistente (404), WEBHOOK (400) e segundo estorno (409)', async () => {
    await expect(
      estornoService.executar({ vendaId: randomUUID(), motivo: '   ', usuarioId: null }),
    ).rejects.toMatchObject({
      status: 400,
      name: 'EstornoFechamentoError',
      message: 'Informe o motivo do estorno',
    });

    await expect(
      estornoService.executar({ vendaId: randomUUID(), motivo: 'Não existe', usuarioId: null }),
    ).rejects.toMatchObject({ status: 404, message: 'Venda não encontrada' });

    const webhook = await prisma.venda.create({
      data: {
        externalId: 'webhook-nao-estornavel',
        origem: 'WEBHOOK',
        processado: true,
        payloadOriginal: { check: 1, items: [] },
      },
    });

    await expect(
      estornoService.executar({ vendaId: webhook.id, motivo: 'Tentativa', usuarioId: null }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Só é possível estornar fechamentos manuais',
    });

    // Segundo estorno em venda manual -> 409 sem alterar estoque nem sobrescrever _estorno
    const ins = await prisma.insumo.create({
      data: { nome: 'Pão', unidade: 'Unidade', estoqueAtual: 20 },
    });
    const prod = await prisma.produto.create({
      data: {
        nome: 'X-Simples',
        fichasTecnicas: { create: [{ insumoId: ins.id, quantidade: 2 }] },
      },
    });
    const fechado = await fechamentoService.confirmar({
      chaveIdempotencia: 'estorno-duplo-seq-01',
      data: '2026-11-13',
      itens: [{ produtoId: prod.id, quantidade: 3 }],
      usuarioId: null,
    });

    const primeiroEstorno = await estornoService.executar({
      vendaId: fechado.vendaId,
      motivo: 'Motivo 1',
      usuarioId: null,
    });
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(20);

    await expect(
      estornoService.executar({ vendaId: fechado.vendaId, motivo: 'Motivo 2', usuarioId: null }),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Este fechamento manual já foi estornado',
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).estoqueAtual).toBe(20);
    const vendaDb = await prisma.venda.findUniqueOrThrow({ where: { id: fechado.vendaId } });
    expect((vendaDb.payloadOriginal as Record<string, unknown>)._estorno).toEqual(
      primeiroEstorno.estorno,
    );
  });

  it('aborta com 422 sem alterar estoque se snapshot for ausente/inválido ou se algum insumo tiver sido apagado', async () => {
    const ins1 = await prisma.insumo.create({
      data: { nome: 'Insumo Vivo', unidade: 'Unidade', estoqueAtual: 50 },
    });
    const ins2 = await prisma.insumo.create({
      data: { nome: 'Insumo Apagado', unidade: 'Unidade', estoqueAtual: 50 },
    });

    // 1) MANUAL sem _fechamento (dado legado)
    const semSnapshot = await prisma.venda.create({
      data: {
        externalId: 'manual:legado-sem-snapshot',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { info: { id: 'manual:legado', check: 1, items: [] }, origem: 'manual' },
      },
    });
    await expect(
      estornoService.executar({ vendaId: semSnapshot.id, motivo: 'Legado', usuarioId: null }),
    ).rejects.toBeInstanceOf(EstornoFechamentoError);
    await expect(
      estornoService.executar({ vendaId: semSnapshot.id, motivo: 'Legado', usuarioId: null }),
    ).rejects.toMatchObject({ status: 422 });

    // 2) MANUAL com payload não-objeto, item inválido ou consumos vazio -> 422
    const payloadString = await prisma.venda.create({
      data: {
        externalId: 'manual:payload-string',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: 'legado-texto',
      },
    });
    await expect(
      estornoService.executar({ vendaId: payloadString.id, motivo: 'String', usuarioId: null }),
    ).rejects.toMatchObject({ status: 422 });

    const consumosVazio = await prisma.venda.create({
      data: {
        externalId: 'manual:consumos-vazios',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { _fechamento: { consumos: [] } },
      },
    });
    await expect(
      estornoService.executar({ vendaId: consumosVazio.id, motivo: 'Vazio', usuarioId: null }),
    ).rejects.toMatchObject({ status: 422 });

    const itemNulo = await prisma.venda.create({
      data: {
        externalId: 'manual:consumo-item-nulo',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { _fechamento: { consumos: [null] } },
      },
    });
    await expect(
      estornoService.executar({ vendaId: itemNulo.id, motivo: 'Nulo', usuarioId: null }),
    ).rejects.toMatchObject({ status: 422 });

    const consumoSemId = await prisma.venda.create({
      data: {
        externalId: 'manual:consumo-sem-id',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { _fechamento: { consumos: [{ insumoId: '', quantidade: 2 }] } },
      },
    });
    await expect(
      estornoService.executar({ vendaId: consumoSemId.id, motivo: 'SemId', usuarioId: null }),
    ).rejects.toMatchObject({ status: 422 });

    const consumoInvalido = await prisma.venda.create({
      data: {
        externalId: 'manual:consumo-qtd-zero',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: { _fechamento: { consumos: [{ insumoId: ins1.id, quantidade: 0 }] } },
      },
    });
    await expect(
      estornoService.executar({ vendaId: consumoInvalido.id, motivo: 'Zero', usuarioId: null }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Fechamento manual sem snapshot de consumos válido para estorno',
    });

    // 3) Insumo do snapshot apagado depois do fechamento: roll back completo sem alterar ins1!
    const vendaInsumoSumiu = await prisma.venda.create({
      data: {
        externalId: 'manual:insumo-apagado-depois',
        origem: 'MANUAL',
        processado: true,
        payloadOriginal: {
          _estorno: null,
          _fechamento: {
            consumos: [
              { insumoId: ins1.id, nome: 'Insumo Vivo', unidade: 'Unidade', quantidade: 10 },
              { insumoId: ins2.id, nome: 'Insumo Apagado', unidade: 'Unidade', quantidade: 5 },
            ],
          },
        },
      },
    });
    await prisma.insumo.delete({ where: { id: ins2.id } });

    await expect(
      estornoService.executar({ vendaId: vendaInsumoSumiu.id, motivo: 'Falta insumo', usuarioId: null }),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Não é possível estornar: um ou mais insumos do fechamento não existem mais',
    });

    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: ins1.id } })).estoqueAtual).toBe(50);
    const vendaAindaNaoEstornada = await prisma.venda.findUniqueOrThrow({
      where: { id: vendaInsumoSumiu.id },
    });
    expect((vendaAindaNaoEstornada.payloadOriginal as Record<string, unknown>)._estorno).toBeNull();
  });
});
