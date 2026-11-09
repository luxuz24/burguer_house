import { useState, useRef, useCallback } from 'react';

export type ResultadoEnvio<TRetorno> =
  | { executado: true; valor: TRetorno }
  | { executado: false };

export interface UseEnvioRetorno<TArgs extends unknown[], TRetorno> {
  enviando: boolean;
  executar: (...args: TArgs) => Promise<ResultadoEnvio<TRetorno>>;
}

/**
 * Hook para travar ações mutativas contra disparos concorrentes ou duplo clique (Achado A2).
 * Usa uma ref síncrona imediata para bloquear reentrância mesmo antes do próximo ciclo de render do React.
 * Retorna { executado: true, valor } se executou a ação ou { executado: false } se foi bloqueado por clique duplo.
 */
export function useEnvio<TArgs extends unknown[], TRetorno>(
  fn: (...args: TArgs) => Promise<TRetorno>,
): UseEnvioRetorno<TArgs, TRetorno> {
  const [enviando, setEnviando] = useState(false);
  const travaRef = useRef(false);

  const executar = useCallback(
    async (...args: TArgs): Promise<ResultadoEnvio<TRetorno>> => {
      // Bloqueio imediato em nível síncrono
      if (travaRef.current) {
        return { executado: false };
      }

      travaRef.current = true;
      setEnviando(true);

      try {
        const resultado = await fn(...args);
        return { executado: true, valor: resultado };
      } finally {
        travaRef.current = false;
        setEnviando(false);
      }
    },
    [fn],
  );

  return { enviando, executar };
}
