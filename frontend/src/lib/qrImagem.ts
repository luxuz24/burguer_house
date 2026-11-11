import { Html5Qrcode } from 'html5-qrcode';

// Leitura de QR code a partir de uma foto (câmera nativa ou galeria), usada na entrada por NFC-e.

interface BarcodeDetectorLike {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

function redimensionarImagem(file: File, maxDimensao: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxDimensao / Math.max(img.width, img.height));
      const largura = Math.max(1, Math.round(img.width * escala));
      const altura = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponível'));
        return;
      }
      ctx.drawImage(img, 0, 0, largura, altura);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao converter imagem'));
            return;
          }
          resolve(new File([blob], 'qrcode.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    img.src = url;
  });
}

export async function decodificarQrDeArquivo(file: File): Promise<string> {
  // 1. Tenta BarcodeDetector nativo do navegador mobile (rápido e lida bem com fotos de alta resolução)
  const BarcodeDetectorCtor = (
    window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (BarcodeDetectorCtor && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const codigos = await detector.detect(bitmap);
      bitmap.close?.();
      const valor = codigos.find((c) => c.rawValue?.trim())?.rawValue?.trim();
      if (valor) return valor;
    } catch {
      // Segue para o fallback do Html5Qrcode
    }
  }

  // 2. Tenta Html5Qrcode.scanFile na imagem original e em versões redimensionadas (fotos de 12MP+ do celular)
  const leitor = new Html5Qrcode('qr-file-reader-hidden');
  try {
    return await leitor.scanFile(file, false);
  } catch {
    for (const dim of [1600, 1000, 700]) {
      try {
        const reduzida = await redimensionarImagem(file, dim);
        return await leitor.scanFile(reduzida, false);
      } catch {
        // Tenta próxima resolução
      }
    }
  } finally {
    try {
      leitor.clear();
    } catch {
      // Ignora limpeza
    }
  }

  throw new Error('Não foi possível identificar um QR Code nítido na foto. Aproxime a câmera do QR Code e tente novamente.');
}
