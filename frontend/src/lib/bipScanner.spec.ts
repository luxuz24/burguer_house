import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tocarBipScanner, lerSomScanner, CHAVE_SOM_SCANNER } from './bipScanner';

describe('lib/bipScanner - preferência "Som e vibração no QR code"', () => {
  let vibrar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrar = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrar });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('com a preferência desligada não vibra (antes vibrava sempre)', () => {
    localStorage.setItem(CHAVE_SOM_SCANNER, 'false');
    tocarBipScanner();
    expect(vibrar).not.toHaveBeenCalled();
  });

  it('ligada (padrão) vibra', () => {
    tocarBipScanner();
    expect(vibrar).toHaveBeenCalledWith(120);
  });

  it('com armazenamento bloqueado vale ligada e não lança erro', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    expect(lerSomScanner()).toBe(true);
    expect(() => tocarBipScanner()).not.toThrow();
    expect(vibrar).toHaveBeenCalledTimes(1);
  });
});
