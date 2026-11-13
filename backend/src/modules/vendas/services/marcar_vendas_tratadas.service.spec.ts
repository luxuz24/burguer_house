import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  anexarTratamentoPayload,
  MarcarVendasTratadasError,
  MarcarVendasTratadasService,
} from './marcar_vendas_tratadas.service.js';

describe('anexarTratamentoPayload', () => {
  const tratamento = {
    motivo: 'Fechamento manual',
    ate: '2026-11-10',
    marcadoEm: '2026-11-13T12:00:00.000Z',
  };

  it('preserva campos de objeto simples e injeta _tratamento', () => {
    const res = anexarTratamentoPayload({ id: 'p1', check: 1 }, tratamento);
    expect(res).toEqual({
      id: 'p1',
      check: 1,
      _tratamento: tratamento,
    });
  });

  it('encapsula payload nulo, primitivo ou array em valorOriginal sem lançar erro', () => {
    expect(anexarTratamentoPayload(null, tratamento)).toEqual({
      valorOriginal: null,
      _tratamento: tratamento,
    });
    expect(anexarTratamentoPayload(undefined, tratamento)).toEqual({
      valorOriginal: null,
      _tratamento: tratamento,
    });
    expect(anexarTratamentoPayload(['item'], tratamento)).toEqual({
      valorOriginal: ['item'],
      _tratamento: tratamento,
    });
    expect(anexarTratamentoPayload('texto', tratamento)).toEqual({
      valorOriginal: 'texto',
      _tratamento: tratamento,
    });
  });
});

describe('MarcarVendasTratadasService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejeita data inválida ou motivo vazio com MarcarVendasTratadasError(400)', async () => {
    const mockDb = { $transaction: vi.fn() };
    const service = new MarcarVendasTratadasService(mockDb as any);

    const errData = await service
      .executar({ ate: '2026-02-31', motivo: 'Teste' })
      .catch((e) => e);
    expect(errData).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errData.name).toBe('MarcarVendasTratadasError');
    expect(errData.statusCode).toBe(400);
    expect(errData.message).toContain('Data inválida');

    const errMotivo = await service
      .executar({ ate: '2026-11-10', motivo: '   ' })
      .catch((e) => e);
    expect(errMotivo).toBeInstanceOf(MarcarVendasTratadasError);
    expect(errMotivo.statusCode).toBe(400);
    expect(errMotivo.message).toContain('Motivo é obrigatório');

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('apara espaços de ate/motivo, filtra até o fim do dia na loja e soma apenas linhas realmente atualizadas', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));

    const findMany = vi.fn().mockResolvedValue([
      { id: 'v1', payloadOriginal: { id: 'p1', info: { items: [] } } },
      { id: 'v2', payloadOriginal: { id: 'p2', info: { items: [] } } },
    ]);
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }); // simula outra rotina marcando v2 em paralelo

    const mockDb = {
      $transaction: async (fn: (tx: any) => Promise<number>) =>
        fn({ venda: { findMany, updateMany } }),
    };

    const service = new MarcarVendasTratadasService(mockDb as any);
    const resultado = await service.executar({
      ate: ' 2026-11-10 ',
      motivo: '  Modo sombra concluído  ',
    });

    expect(resultado).toEqual({ marcadas: 1, ate: '2026-11-10' });

    // 2026-11-10 23:59:59.999 em Campo Grande (UTC-4) -> 2026-11-11T03:59:59.999Z
    expect(findMany).toHaveBeenCalledWith({
      where: {
        processado: false,
        criadoEm: { lte: new Date('2026-11-11T03:59:59.999Z') },
      },
      select: { id: true, payloadOriginal: true },
    });

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'v1', processado: false },
      data: {
        processado: true,
        payloadOriginal: {
          id: 'p1',
          info: { items: [] },
          _tratamento: {
            motivo: 'Modo sombra concluído',
            ate: '2026-11-10',
            marcadoEm: '2026-11-13T15:00:00.000Z',
          },
        },
      },
    });
  });

  it('retorna marcadas = 0 quando não há vendas pendentes até a data', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const updateMany = vi.fn();
    const mockDb = {
      $transaction: async (fn: (tx: any) => Promise<number>) =>
        fn({ venda: { findMany, updateMany } }),
    };

    const resultado = await new MarcarVendasTratadasService(mockDb as any).executar({
      ate: '2026-11-10',
      motivo: 'Sem pendências',
    });

    expect(resultado).toEqual({ marcadas: 0, ate: '2026-11-10' });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
