import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { AxiosError } from 'axios';
import { MotionGlobalConfig } from 'motion/react';
import { api } from '../lib/api';
import { limparArmazenamentoEmMemoria } from '../lib/armazenamento';

// Testes nunca falam com um servidor de verdade: sem mock, a requisição falha como "sem conexão".
// O adapter padrão (XHR do jsdom) mandava para http://localhost:3000; com o backend de dev no ar,
// a resposta 401 de uma requisição escapada chegava no teste seguinte e derrubava a sessão dele.
api.defaults.adapter = (config) =>
  Promise.reject(
    new AxiosError(`Requisição sem mock nos testes: ${config.method?.toUpperCase()} ${config.url}`, AxiosError.ERR_NETWORK, config),
  );

// Desativa animações no ambiente jsdom para que AnimatePresence não atrase a desmontagem
MotionGlobalConfig.skipAnimations = true;

// Polyfill para window.matchMedia no ambiente jsdom
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom não tem IntersectionObserver (usado pelo useInView do AnimatedNumber): considera tudo visível.
if (typeof window !== 'undefined' && !('IntersectionObserver' in window)) {
  class IntersectionObserverFalso {
    private readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(alvo: Element) {
      this.callback(
        [{ isIntersecting: true, target: alvo, intersectionRatio: 1 } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IntersectionObserverFalso });
}

// Limpeza global entre testes para isolamento completo de mocks e storage (🟡 4)
afterEach(() => {
  localStorage.clear();
  limparArmazenamentoEmMemoria();
  vi.restoreAllMocks();
});
