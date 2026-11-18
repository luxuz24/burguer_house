import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { usePodeGerir } from './usePodeGerir';
import { AuthProvider, type UsuarioAuth } from '../context/AuthContext';
import { configurarAuthStorage } from '../test/render';
import { mockUsuarioAdmin, mockUsuarioGerente, mockUsuarioOperador } from '../test/fixtures/auth.fixture';

function comSessao(usuario: UsuarioAuth | null) {
  configurarAuthStorage(usuario !== null, usuario ?? mockUsuarioAdmin);
  return ({ children }: { children: ReactNode }) => (
    <AuthProvider verificarSessao={false}>{children}</AuthProvider>
  );
}

describe('hooks/usePodeGerir (só o ADMIN gere; os demais só leem)', () => {
  it('ADMIN → true', () => {
    const { result } = renderHook(() => usePodeGerir(), { wrapper: comSessao(mockUsuarioAdmin) });
    expect(result.current).toBe(true);
  });

  it('GERENTE → false', () => {
    const { result } = renderHook(() => usePodeGerir(), { wrapper: comSessao(mockUsuarioGerente) });
    expect(result.current).toBe(false);
  });

  it('OPERADOR → false', () => {
    const { result } = renderHook(() => usePodeGerir(), { wrapper: comSessao(mockUsuarioOperador) });
    expect(result.current).toBe(false);
  });

  it('sem usuário logado → false', () => {
    const { result } = renderHook(() => usePodeGerir(), { wrapper: comSessao(null) });
    expect(result.current).toBe(false);
  });

  it('fora do AuthProvider → false (não lança)', () => {
    const { result } = renderHook(() => usePodeGerir());
    expect(result.current).toBe(false);
  });

  it('papel desconhecido vindo do cache → false', () => {
    const { result } = renderHook(() => usePodeGerir(), {
      wrapper: comSessao({ ...mockUsuarioAdmin, role: 'admin' as unknown as UsuarioAuth['role'] }),
    });
    expect(result.current).toBe(false);
  });
});
