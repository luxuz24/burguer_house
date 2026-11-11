import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodificarQrDeArquivo } from './qrImagem';

const leitor = vi.hoisted(() => ({
  scanFile: vi.fn(),
  clear: vi.fn(),
  ids: [] as string[],
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor(id: string) {
      leitor.ids.push(id);
    }
    scanFile(...args: unknown[]) {
      return leitor.scanFile(...args);
    }
    clear() {
      leitor.clear();
    }
  },
}));

const foto = () => new File(['jpg'], 'foto.jpg', { type: 'image/jpeg' });
const ERRO_FINAL = /Não foi possível identificar um QR Code nítido/;

/** Image falsa: dispara onload com o tamanho pedido (ou onerror). */
function stubImagem(largura: number, altura: number, falhar = false) {
  class ImagemFalsa {
    width = largura;
    height = altura;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => (falhar ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', ImagemFalsa);
}

/** Canvas falso: registra o tamanho final e devolve um blob (ou null). */
function stubCanvas(opcoes: { semContexto?: boolean; semBlob?: boolean } = {}) {
  const tamanhos: Array<{ w: number; h: number }> = [];
  const criarOriginal = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag !== 'canvas') return criarOriginal(tag);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => (opcoes.semContexto ? null : { drawImage: vi.fn() }),
      toBlob: (cb: (b: Blob | null) => void, tipo: string, qualidade: number) => {
        tamanhos.push({ w: canvas.width, h: canvas.height });
        expect(tipo).toBe('image/jpeg');
        expect(qualidade).toBe(0.92);
        cb(opcoes.semBlob ? null : new Blob(['x'], { type: tipo }));
      },
    };
    return canvas as unknown as HTMLElement;
  }) as typeof document.createElement);
  return tamanhos;
}

describe('lib/qrImagem - leitura de QR code por foto', () => {
  const revogar = vi.fn();

  beforeEach(() => {
    leitor.scanFile.mockReset();
    leitor.clear.mockReset();
    leitor.ids = [];
    revogar.mockReset();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => 'blob:foto', revokeObjectURL: revogar }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa o BarcodeDetector nativo quando existe e devolve o texto sem espaços', async () => {
    const fechar = vi.fn();
    const formatos: string[][] = [];
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: fechar }));
    vi.stubGlobal('BarcodeDetector', class {
      constructor(opts: { formats: string[] }) {
        formatos.push(opts.formats);
      }
      detect() {
        return Promise.resolve([{ rawValue: '   ' }, { rawValue: '  http://www.dfe.ms.gov.br/nfce?p=123  ' }]);
      }
    });
    await expect(decodificarQrDeArquivo(foto())).resolves.toBe('http://www.dfe.ms.gov.br/nfce?p=123');
    expect(formatos).toEqual([['qr_code']]);
    expect(fechar).toHaveBeenCalledTimes(1);
    expect(leitor.scanFile).not.toHaveBeenCalled();
  });

  it('BarcodeDetector sem resultado cai no Html5Qrcode e limpa o leitor', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({}));
    vi.stubGlobal('BarcodeDetector', class {
      detect() {
        return Promise.resolve([]);
      }
    });
    leitor.scanFile.mockResolvedValue('CHAVE');
    await expect(decodificarQrDeArquivo(foto())).resolves.toBe('CHAVE');
    expect(leitor.ids).toEqual(['qr-file-reader-hidden']);
    expect(leitor.scanFile).toHaveBeenCalledWith(expect.any(File), false);
    expect(leitor.clear).toHaveBeenCalledTimes(1);
  });

  it('sem BarcodeDetector, se a foto original falha tenta reduzida a 1600 px (mantendo a proporção)', async () => {
    stubImagem(4000, 3000);
    const tamanhos = stubCanvas();
    leitor.scanFile.mockRejectedValueOnce(new Error('grande demais')).mockResolvedValueOnce('CHAVE-REDUZIDA');
    await expect(decodificarQrDeArquivo(foto())).resolves.toBe('CHAVE-REDUZIDA');
    expect(tamanhos).toEqual([{ w: 1600, h: 1200 }]);
    const [reduzida] = leitor.scanFile.mock.calls[1]!;
    expect((reduzida as File).name).toBe('qrcode.jpg');
    expect((reduzida as File).type).toBe('image/jpeg');
    expect(revogar).toHaveBeenCalledWith('blob:foto');
  });

  it('tenta 1600, 1000 e 700 px; imagem menor que o limite não é ampliada', async () => {
    stubImagem(800, 400);
    const tamanhos = stubCanvas();
    leitor.scanFile.mockRejectedValue(new Error('sem QR'));
    await expect(decodificarQrDeArquivo(foto())).rejects.toThrow(ERRO_FINAL);
    expect(tamanhos).toEqual([{ w: 800, h: 400 }, { w: 800, h: 400 }, { w: 700, h: 350 }]);
    expect(leitor.scanFile).toHaveBeenCalledTimes(4);
    expect(leitor.clear).toHaveBeenCalledTimes(1);
  });

  it('imagem que não carrega, canvas indisponível ou blob nulo terminam no erro amigável', async () => {
    leitor.scanFile.mockRejectedValue(new Error('sem QR'));

    stubImagem(100, 100, true);
    stubCanvas();
    await expect(decodificarQrDeArquivo(foto())).rejects.toThrow(ERRO_FINAL);
    expect(revogar).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();

    stubImagem(100, 100);
    stubCanvas({ semContexto: true });
    await expect(decodificarQrDeArquivo(foto())).rejects.toThrow(ERRO_FINAL);
    vi.restoreAllMocks();

    stubImagem(100, 100);
    const tamanhos = stubCanvas({ semBlob: true });
    await expect(decodificarQrDeArquivo(foto())).rejects.toThrow(ERRO_FINAL);
    expect(tamanhos).toHaveLength(3);
  });

  it('erro ao limpar o leitor não esconde o resultado', async () => {
    leitor.scanFile.mockResolvedValue('CHAVE');
    leitor.clear.mockImplementation(() => {
      throw new Error('já limpo');
    });
    await expect(decodificarQrDeArquivo(foto())).resolves.toBe('CHAVE');
  });

  it('imagem 1x1 extrema continua com pelo menos 1 px', async () => {
    stubImagem(1, 20000);
    const tamanhos = stubCanvas();
    leitor.scanFile.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('OK');
    await decodificarQrDeArquivo(foto());
    expect(tamanhos).toEqual([{ w: 1, h: 1600 }]);
  });
});
