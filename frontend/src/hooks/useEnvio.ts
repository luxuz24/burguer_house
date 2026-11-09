import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseEnvioRetorno<TArgs extends unknown[], TRetorno> {
  enviando: boolean;
  executar: (...args: TArgs) => Promise<TRetorno | undefined>;
}

/**
 * Hook para travar ações mutativas contra disparos concorrentes ou duplo clique (Achado A2).
 * Usa uma ref síncrona imediata para bloquear reentrância mesmo antes do próximo render ciclo do React.
 */
export function useEnvio<TArgs extends unknown[], TRetorno>(
  fn: (...args: TArgs) => Promise<TRetorno>,
): UseEnvioRetorno<TArgs, TRetorno> {
  const [enviando, setEnviando] = useState(false);
  const travaRef = useRef(false);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const executar = useCallback(
    async (...args: TArgs): Promise<TRetorno | undefined> => {
      // Bloqueio imediato em nível síncrono
      if (travaRef.current) {
        return undefined;
      }

      travaRef.current = true;
      if (montadoRef.current) {
        setEnviando(true);
      }

      try {
        const resultado = await fn(...args);
        return resultado;
      } finally {
        travaRef.current = false;
        if (montadoRef.current) {
          setEnviando(false);
        }
      }
    },
    [fn],
  );

  return { enviando, executar };
}
