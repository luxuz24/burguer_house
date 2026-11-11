import { describe, expect, it, vi } from 'vitest';
import { gravarArmazenado, lerArmazenado, removerArmazenado } from './armazenamento';

function falhar(nome: string) {
  return () => {
    throw new DOMException('negado', nome);
  };
}

describe('lib/armazenamento', () => {
  it('com o localStorage disponível, lê, grava e remove nele', () => {
    gravarArmazenado('k', 'v1');
    expect(localStorage.getItem('k')).toBe('v1');
    expect(lerArmazenado('k')).toBe('v1');
    removerArmazenado('k');
    expect(localStorage.getItem('k')).toBeNull();
    expect(lerArmazenado('k')).toBeNull();
  });

  it('chave inexistente devolve null', () => {
    expect(lerArmazenado('nao-existe')).toBeNull();
  });

  it('com o armazenamento bloqueado nada lança e o valor vale em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(falhar('SecurityError'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(falhar('SecurityError'));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(falhar('SecurityError'));

    expect(lerArmazenado('k')).toBeNull();
    expect(() => gravarArmazenado('k', 'v1')).not.toThrow();
    expect(lerArmazenado('k')).toBe('v1');
    expect(() => removerArmazenado('k')).not.toThrow();
    expect(lerArmazenado('k')).toBeNull();
  });

  it('cota cheia ao regravar: não devolve o valor antigo do localStorage', () => {
    localStorage.setItem('k', 'antigo');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(falhar('QuotaExceededError'));

    gravarArmazenado('k', 'novo');

    expect(lerArmazenado('k')).toBe('novo');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('uma gravação bem-sucedida depois de uma falha descarta a cópia em memória', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(falhar('QuotaExceededError'));
    gravarArmazenado('k', 'memoria');
    setItem.mockRestore();

    gravarArmazenado('k', 'disco');
    localStorage.removeItem('k');

    expect(lerArmazenado('k')).toBeNull();
  });
});
