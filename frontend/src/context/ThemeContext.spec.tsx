import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';

const CHAVE_TEMA = 'burger_stock_theme';
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

function bloquearStorage() {
  const erro = () => {
    throw new DOMException('negado', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(erro);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(erro);
}

function simularSistemaEscuro(escuro: boolean) {
  const ouvintes: Array<() => void> = [];
  const mq = {
    matches: escuro,
    addEventListener: (_: string, fn: () => void) => ouvintes.push(fn),
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, 'matchMedia').mockImplementation(() => mq as unknown as MediaQueryList);
  return {
    mudar(novo: boolean) {
      mq.matches = novo;
      ouvintes.forEach((fn) => fn());
    },
    mq,
  };
}

describe('ThemeContext', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('valor inválido salvo cai em "system" sem quebrar', () => {
    localStorage.setItem(CHAVE_TEMA, 'roxo');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('system');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('system');
  });

  it('tema salvo é respeitado e aplica a classe dark', () => {
    localStorage.setItem(CHAVE_TEMA, 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme e toggleTheme trocam o tema, gravam a escolha e a classe acompanha', () => {
    localStorage.setItem(CHAVE_TEMA, 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current.setTheme('system'));
    expect(result.current.theme).toBe('system');
    expect(localStorage.getItem(CHAVE_TEMA)).toBe('system');
  });

  it('em "system" segue a preferência do aparelho e reage quando ela muda', () => {
    const sistema = simularSistemaEscuro(false);
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);

    act(() => sistema.mudar(true));
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('fora de "system" não escuta a preferência do aparelho', () => {
    localStorage.setItem(CHAVE_TEMA, 'light');
    const sistema = simularSistemaEscuro(true);
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => sistema.mudar(true));
    expect(result.current.isDark).toBe(false);
  });

  it('com o armazenamento bloqueado (aba anônima) abre em "system" e troca de tema sem lançar', () => {
    bloquearStorage();
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('system');

    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sem matchMedia (webview antigo), "system" vira claro em vez de quebrar', () => {
    const original = window.matchMedia;
    // @ts-expect-error simulando navegador sem a API
    delete window.matchMedia;
    try {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('system');
      expect(result.current.isDark).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });

  it('o valor do contexto é estável entre renders sem troca de tema', () => {
    localStorage.setItem(CHAVE_TEMA, 'light');
    const { result, rerender } = renderHook(() => useTheme(), { wrapper });
    const antes = result.current;
    rerender();
    expect(result.current).toBe(antes);
  });

  it('useTheme fora do provider avisa com erro claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow('useTheme deve ser usado dentro de um ThemeProvider');
  });
});
