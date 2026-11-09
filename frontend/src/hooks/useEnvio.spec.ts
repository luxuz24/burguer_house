import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnvio, type ResultadoEnvio } from './useEnvio';

describe('hooks/useEnvio - Trava de Submissão contra Duplo Clique (Achado A2)', () => {
  it('executa a acao normalmente alternando o estado de enviando e retornando executado: true', async () => {
    let resolver!: (val: string) => void;
    const promessa = new Promise<string>((resolve) => {
      resolver = resolve;
    });

    const fn = vi.fn((val: string) => {
      void val;
      return promessa;
    });
    const { result } = renderHook(() => useEnvio(fn));

    expect(result.current.enviando).toBe(false);

    let execPromessa!: Promise<ResultadoEnvio<string>>;
    act(() => {
      execPromessa = result.current.executar('param1');
    });

    expect(result.current.enviando).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('param1');

    let resFinal!: ResultadoEnvio<string>;
    await act(async () => {
      resolver('sucesso');
      resFinal = await execPromessa;
    });

    expect(result.current.enviando).toBe(false);
    expect(resFinal).toEqual({ executado: true, valor: 'sucesso' });
  });

  it('bloqueia duplo clique imediato retornando executado: false na chamada concorrente', async () => {
    let resolver!: () => void;
    const promessa = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    const fn = vi.fn(() => promessa);
    const { result } = renderHook(() => useEnvio(fn));

    let p1!: Promise<ResultadoEnvio<void>>;
    let p2!: Promise<ResultadoEnvio<void>>;

    act(() => {
      p1 = result.current.executar();
      p2 = result.current.executar(); // Duplo clique no mesmo ciclo síncrono
    });

    expect(fn).toHaveBeenCalledTimes(1);

    let res1!: ResultadoEnvio<void>;
    let res2!: ResultadoEnvio<void>;
    await act(async () => {
      resolver();
      [res1, res2] = await Promise.all([p1, p2]);
    });

    // A primeira chamada foi executada normalmente
    expect(res1).toEqual({ executado: true, valor: undefined });
    // A segunda chamada foi bloqueada imediatamente pela trava atômica
    expect(res2).toEqual({ executado: false });

    expect(result.current.enviando).toBe(false);

    // Permite nova submissão após término
    let resNova!: ResultadoEnvio<void>;
    await act(async () => {
      resNova = await result.current.executar();
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(resNova).toEqual({ executado: true, valor: undefined });
  });

  it('libera a trava quando a operacao falha, permitindo nova tentativa', async () => {
    let rejeitar!: (err: Error) => void;
    const promessa = new Promise<void>((_, reject) => {
      rejeitar = reject;
    });

    const fn = vi.fn<() => Promise<void | string>>(() => promessa);
    const { result } = renderHook(() => useEnvio(fn));

    let execPromessa!: Promise<ResultadoEnvio<void | string>>;
    act(() => {
      execPromessa = result.current.executar();
    });

    expect(result.current.enviando).toBe(true);

    await act(async () => {
      rejeitar(new Error('Falha de rede'));
      await expect(execPromessa).rejects.toThrow('Falha de rede');
    });

    expect(result.current.enviando).toBe(false);

    // Nova tentativa liberada
    fn.mockResolvedValueOnce('ok');
    let resTentativa!: ResultadoEnvio<void | string>;
    await act(async () => {
      resTentativa = await result.current.executar();
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(resTentativa).toEqual({ executado: true, valor: 'ok' });
  });

  it('nao atualiza estado apos desmontagem do componente', async () => {
    let resolver!: (val: string) => void;
    const promessa = new Promise<string>((resolve) => {
      resolver = resolve;
    });

    const fn = vi.fn(() => promessa);
    const { result, unmount } = renderHook(() => useEnvio(fn));

    let execPromessa!: Promise<ResultadoEnvio<string>>;
    act(() => {
      execPromessa = result.current.executar();
    });

    expect(result.current.enviando).toBe(true);

    // Desmonta componente enquanto a requisição está em trânsito
    unmount();

    let resFinal!: ResultadoEnvio<string>;
    await act(async () => {
      resolver('finalizado');
      resFinal = await execPromessa;
    });

    // A promessa interna resolve com sucesso mesmo após desmontar
    expect(resFinal).toEqual({ executado: true, valor: 'finalizado' });
    // montadoRef evitou a chamada setEnviando(false) no componente já desmontado
    expect(result.current.enviando).toBe(true);
  });
});
