import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from 'vitest';
import { Prisma } from '../../../../generated/prisma/client.js';
import { prisma } from '../../../infra/database/prisma.js';
import { obterIntervaloDiaLoja, obterPartesDataLoja } from '../../../shared/datas.js';
import {
  MarcarVendasTratadasError,
  MarcarVendasTratadasService,
} from './marcar_vendas_tratadas.service.js';

function formatarDiaLoja(data: Date): string {
  const { ano, mes, dia } = obterPartesDataLoja(data);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

describe('MarcarVendasTratadasService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejeita data inválida, data futura, motivo vazio ou usuarioId vazio com MarcarVendasTratadasError(400)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z')); // 11h MS

    const mockDb = { $executeRaw: vi.fn(), venda: { count: vi.fn() } };
    const service = new MarcarVendasTratadasService(mockDb as any);

    const errData = await service
      .executar({ ate: '2026-02-31', motivo: 'Teste', usuarioId: 'u1' })
      .catch((e) => e);
    expect(errData).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errData.name).toBe('MarcarVendasTratadasError');
    expect(errData.statusCode).toBe(400);
    expect(errData.message).toContain('Data inválida');

    const errFutura = await service
      .executar({ ate: '2026-11-14', motivo: 'Teste futuro', usuarioId: 'u1' })
      .catch((e) => e);
    expect(errFutura).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errFutura.statusCode).toBe(400);
    expect(errFutura.message).toBe('A data não pode ser futura');

    const errMotivo = await service
      .executar({ ate: '2026-11-13', motivo: '   ', usuarioId: 'u1' })
      .catch((e) => e);
    expect(errMotivo).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errMotivo.statusCode).toBe(400);
    expect(errMotivo.message).toContain('Motivo é obrigatório');

    const errUsuario = await service
      .executar({ ate: '2026-11-13', motivo: 'Motivo ok', usuarioId: '   ' })
      .catch((e) => e);
    expect(errUsuario).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errUsuario.statusCode).toBe(400);
    expect(errUsuario.message).toBe('Usuário executor é obrigatório');

    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
    expect(mockDb.venda.count).not.toHaveBeenCalled();
  });

  it('apara espaços de ate/motivo/usuarioId, aceita hoje, passa parâmetros ao UPDATE em lote e omite simulacao', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));

    const executeRaw = vi.fn().mockResolvedValue(2);
    const service = new MarcarVendasTratadasService({ $executeRaw: executeRaw } as any);

    const resultado = await service.executar({
      ate: ' 2026-11-13 ',
      motivo: '  Modo sombra concluído  ',
      usuarioId: '  user-123  ',
    });

    expect(resultado).toEqual({ marcadas: 2, ate: '2026-11-13' });
    expect('simulacao' in resultado).toBe(false);
    expect(executeRaw).toHaveBeenCalledTimes(1);

    const [, tratamentoJson, tratamentoJsonElse, fimDoDia] = executeRaw.mock.calls[0]!;
    expect(JSON.parse(tratamentoJson as string)).toEqual({
      motivo: 'Modo sombra concluído',
      ate: '2026-11-13',
      marcadoEm: '2026-11-13T15:00:00.000Z',
      usuarioId: 'user-123',
    });
    expect(tratamentoJsonElse).toBe(tratamentoJson);
    // 2026-11-13 23:59:59.999 em Campo Grande (UTC-4) -> 2026-11-14T03:59:59.999Z
    expect(fimDoDia).toEqual(new Date('2026-11-14T03:59:59.999Z'));
  });

  it('em modo simulacao conta sem chamar UPDATE e devolve simulacao: true', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));

    const executeRaw = vi.fn();
    const count = vi.fn().mockResolvedValue(5);
    const service = new MarcarVendasTratadasService({
      $executeRaw: executeRaw,
      venda: { count },
    } as any);

    const resultado = await service.executar({
      ate: '2026-11-10',
      motivo: 'Prévia',
      usuarioId: 'u1',
      simulacao: true,
    });

    expect(resultado).toEqual({ marcadas: 5, ate: '2026-11-10', simulacao: true });
    expect(executeRaw).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith({
      where: {
        processado: false,
        criadoEm: { lte: new Date('2026-11-11T03:59:59.999Z') },
      },
    });
  });

  it('retorna marcadas = 0 quando o UPDATE em lote não afeta linhas', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));

    const executeRaw = vi.fn().mockResolvedValue(0);
    const resultado = await new MarcarVendasTratadasService({ $executeRaw: executeRaw } as any).executar({
      ate: '2026-11-10',
      motivo: 'Sem pendências',
      usuarioId: 'u1',
    });

    expect(resultado).toEqual({ marcadas: 0, ate: '2026-11-10' });
  });
});

describe('MarcarVendasTratadasService — volume em lote e preservação de payload (banco de teste)', () => {
  beforeEach(async () => {
    await prisma.venda.deleteMany().catch(() => {});
  });

  afterAll(async () => {
    await prisma.venda.deleteMany().catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('marca 3.000 vendas pendentes antigas abaixo de 2s, trata objeto/array/null e respeita filtros WHERE', async () => {
    const { inicio: inicioHoje } = obterIntervaloDiaLoja(new Date());
    const criadaAntes = new Date(inicioHoje.getTime() - 6 * 3600_000); // 18h de ontem em MS
    const criadaDepois = new Date(inicioHoje.getTime() + 5 * 60_000); // 00:05 de hoje em MS
    const dataAlvo = formatarDiaLoja(criadaAntes);

    const lotePadrao = Array.from({ length: 2997 }, (_, idx) => ({
      externalId: `lote-${idx}`,
      payloadOriginal: { id: `lote-${idx}`, check: 1 },
      processado: false,
      criadoEm: criadaAntes,
    }));

    await prisma.venda.createMany({ data: lotePadrao });

    const vendaObjeto = await prisma.venda.create({
      data: {
        externalId: 'espec-objeto',
        payloadOriginal: { id: 'espec-objeto', check: 1, info: { items: [{ name: 'X' }] } },
        processado: false,
        criadoEm: criadaAntes,
      },
    });
    const vendaArray = await prisma.venda.create({
      data: {
        externalId: 'espec-array',
        payloadOriginal: ['item-1', 'item-2'],
        processado: false,
        criadoEm: criadaAntes,
      },
    });
    const vendaNull = await prisma.venda.create({
      data: {
        externalId: 'espec-null',
        payloadOriginal: Prisma.JsonNull,
        processado: false,
        criadoEm: criadaAntes,
      },
    });

    // Venda pendente POSTERIOR à data: não pode ser tocada
    const vendaOutroDia = await prisma.venda.create({
      data: {
        externalId: 'espec-outro-dia',
        payloadOriginal: { id: 'espec-outro-dia', check: 1 },
        processado: false,
        criadoEm: criadaDepois,
      },
    });

    // Venda JÁ processada até a data: não pode ser recontada nem ter _tratamento sobrescrito
    const vendaJaProcessada = await prisma.venda.create({
      data: {
        externalId: 'espec-ja-processada',
        payloadOriginal: { id: 'espec-ja-processada', check: 1 },
        processado: true,
        criadoEm: criadaAntes,
      },
    });

    const inicioMs = Date.now();
    const resultado = await new MarcarVendasTratadasService().executar({
      ate: dataAlvo,
      motivo: 'Limpeza em lote',
      usuarioId: 'u-lote',
    });
    const duracaoMs = Date.now() - inicioMs;

    expect(resultado).toEqual({ marcadas: 3000, ate: dataAlvo });
    expect(duracaoMs).toBeLessThan(2000);

    const pendentesRestantes = await prisma.venda.count({ where: { processado: false } });
    expect(pendentesRestantes).toBe(1);

    const objDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaObjeto.id } });
    expect(objDb.payloadOriginal).toMatchObject({
      id: 'espec-objeto',
      check: 1,
      _tratamento: { motivo: 'Limpeza em lote', ate: dataAlvo, usuarioId: 'u-lote' },
    });

    const arrDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaArray.id } });
    expect(arrDb.payloadOriginal).toMatchObject({
      valorOriginal: ['item-1', 'item-2'],
      _tratamento: { motivo: 'Limpeza em lote', ate: dataAlvo, usuarioId: 'u-lote' },
    });

    const nullDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaNull.id } });
    expect(nullDb.payloadOriginal).toMatchObject({
      valorOriginal: null,
      _tratamento: { motivo: 'Limpeza em lote', ate: dataAlvo, usuarioId: 'u-lote' },
    });

    const outroDiaDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaOutroDia.id } });
    expect(outroDiaDb.processado).toBe(false);
    expect((outroDiaDb.payloadOriginal as any)._tratamento).toBeUndefined();

    const jaProcDb = await prisma.venda.findUniqueOrThrow({ where: { id: vendaJaProcessada.id } });
    expect(jaProcDb.processado).toBe(true);
    expect((jaProcDb.payloadOriginal as any)._tratamento).toBeUndefined();
  });
});
