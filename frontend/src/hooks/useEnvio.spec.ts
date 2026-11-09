import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEnvio } from './useEnvio';

describe('hooks/useEnvio - Trava de Submissão contra Duplo Clique (Achado A2)', () => {
  it('executa a acao normalmente alternando o estado de enviando', async () => {
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

    let execPromessa: Promise<string | undefined>;
    act(() => {
      execPromessa = result.current.executar('param1');
    });

    expect(result.current.enviando).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('param1');

    await act(async () => {
      resolver('sucesso');
      await execPromessa;
    });

    expect(result.current.enviando).toBe(false);
  });

  it('bloqueia duplo clique imediato disparando a funcao interna apenas uma vez', async () => {
    let resolver!: () => void;
    const promessa = new Promise<void>((resolve) => {
      resolver = resolve;
    });

    const fn = vi.fn(() => promessa);
    const { result } = renderHook(() => useEnvio(fn));

    let p1!: Promise<void | undefined>;
    let p2!: Promise<void | undefined>;

    act(() => {
      p1 = result.current.executar();
      p2 = result.current.executar(); // Duplo clique no mesmo ciclo síncrono
    });

    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolver();
      const [, res2] = await Promise.all([p1, p2]);
      expect(res2).toBeUndefined(); // Segunda chamada descartada pela trava
    });

    expect(result.current.enviando).toBe(false);

    // Permite nova submissão após término
    await act(async () => {
      await result.current.executar();
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('libera a trava quando a operacao falha, permitindo nova tentativa', async () => {
    let rejeitar!: (err: Error) => void;
    const promessa = new Promise<void>((_, reject) => {
      rejeitar = reject;
    });

    const fn = vi.fn<() => Promise<void | string>>(() => promessa);
    const { result } = renderHook(() => useEnvio(fn));

    let execPromessa!: Promise<void | string | undefined>;
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
    let resTentativa: void | string | undefined;
    await act(async () => {
      resTentativa = await result.current.executar();
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(resTentativa).toBe('ok');
  });

  it('nao atualiza estado apos desmontagem do componente', async () => {
    let resolver!: (val: string) => void;
    const promessa = new Promise<string>((resolve) => {
      resolver = resolve;
    });

    const fn = vi.fn(() => promessa);
    const { result, unmount } = renderHook(() => useEnvio(fn));

    act(() => {
      result.current.executar();
    });

    expect(result.current.enviando).toBe(true);

    // Desmonta componente enquanto a requisição está em trânsito
    unmount();

    await act(async () => {
      resolver('finalizado');
      await promessa;
    });

    // Se não estivesse protegido por montadoRef, o React emitiria erro de state update em unmounted component
  });
});
