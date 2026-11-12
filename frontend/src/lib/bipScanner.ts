import { lerArmazenado } from './armazenamento';

/** Preferência "Som e vibração no QR code" (Configurações), por aparelho. */
export const CHAVE_SOM_SCANNER = 'cfg_som_scanner';

/** Ligada por padrão; com armazenamento bloqueado (aba anônima) também vale ligada ou o valor em memória. */
export function lerSomScanner(): boolean {
  return lerArmazenado(CHAVE_SOM_SCANNER) !== 'false';
}

/** Bip curto e vibração ao ler um código, se a preferência estiver ligada. */
export function tocarBipScanner(): void {
  if (!lerSomScanner()) return;

  if (typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        // Fecha o contexto ao fim do bip: um AudioContext aberto por leitura acumulava até o limite do navegador.
        osc.onended = () => {
          ctx.close().catch(() => {});
        };
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Ignora se o navegador bloquear autoplay de áudio
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(120);
    } catch {
      // Ignora erro de vibração
    }
  }
}
