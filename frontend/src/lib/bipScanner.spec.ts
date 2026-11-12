import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tocarBipScanner, lerSomScanner, CHAVE_SOM_SCANNER } from './bipScanner';
import { gravarArmazenado, limparArmazenamentoEmMemoria } from './armazenamento';

function mockAudioContext() {
  const fechar = vi.fn().mockResolvedValue(undefined);
  const osciladores: Array<{ onended: (() => void) | null; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = [];
  const createOscillator = vi.fn(() => {
    const osc = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    osciladores.push(osc);
    return osc;
  });
  class AudioContextFalso {
    currentTime = 0;
    destination = {};
    close = fechar;
    createOscillator = createOscillator;
    createGain() {
      return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
    }
  }
  vi.stubGlobal('AudioContext', AudioContextFalso);
  return { fechar, osciladores, createOscillator };
}

describe('lib/bipScanner - preferência "Som e vibração no QR code"', () => {
  let vibrar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    limparArmazenamentoEmMemoria();
    vibrar = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: vibrar });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    limparArmazenamentoEmMemoria();
  });

  it('com a preferência desligada não vibra nem cria oscilador de áudio', () => {
    const { createOscillator } = mockAudioContext();
    localStorage.setItem(CHAVE_SOM_SCANNER, 'false');
    tocarBipScanner();
    expect(vibrar).not.toHaveBeenCalled();
    expect(createOscillator).not.toHaveBeenCalled();
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

  it('com armazenamento bloqueado, desligar a preferência silencia o bip e a vibração', () => {
    const { createOscillator } = mockAudioContext();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    gravarArmazenado(CHAVE_SOM_SCANNER, 'false');

    expect(lerSomScanner()).toBe(false);

    tocarBipScanner();
    expect(vibrar).not.toHaveBeenCalled();
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it('fecha o AudioContext quando o bip termina (antes vazava um contexto por leitura)', () => {
    const { fechar, osciladores } = mockAudioContext();
    tocarBipScanner();
    expect(osciladores).toHaveLength(1);
    expect(fechar).not.toHaveBeenCalled();
    // Bip de 150 ms ligado à saída de áudio
    const osc = osciladores[0] as unknown as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> };
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledWith(0.15);
    expect(osc.connect).toHaveBeenCalledTimes(1);
    osciladores[0]!.onended?.();
    expect(fechar).toHaveBeenCalledTimes(1);
  });
});
