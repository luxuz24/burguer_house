import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

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

// Limpeza global entre testes para isolamento completo de mocks e storage (🟡 4)
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
