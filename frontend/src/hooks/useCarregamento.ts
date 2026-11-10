import { useState, useEffect, useCallback, useRef } from 'react';
import type { DependencyList } from 'react';
import { mensagemDeErro } from '../lib/api';

export type ErroCarregamento = { tipo: 'nao_encontrado' | 'erro'; mensagem: string };

export interface OpcoesCarregamento {
  mensagemPadrao?: string;
  habilitado?: boolean;
}

export interface RetornoCarregamento<T> {
  dados: T | null;
  carregandoInicial: boolean;
  erro: ErroCarregamento | null;
  erroRecarga: string | null;
  recarregar: () => Promise<boolean>;
  tentarNovamente: () => void;
}

/**
 * Hook universal de carregamento e sincronização em segundo plano.
 *
 * Gerencia ciclo de vida de busca de dados com:
 * - Carga inicial com estado explícito de erro (404 vs 5xx/rede).
 * - Recarga suave em segundo plano que preserva dados existentes e alerta falhas.
 * - Descarte de respostas fora de ordem via contador atômico (sem flags ativo/montado).
 * - Isolamento de side-effects visuais (sem disparo de toasts dentro do hook).
 */
export function useCarregamento<T>(
  buscar: () => Promise<T>,
  deps: DependencyList,
  opcoes?: OpcoesCarregamento,
): RetornoCarregamento<T> {
  const habilitado = opcoes?.habilitado ?? true;
  const mensagemPadrao = opcoes?.mensagemPadrao;

  const [dados, setDados] = useState<T | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(() => habilitado);
  const [erro, setErro] = useState<ErroCarregamento | null>(null);
  const [erroRecarga, setErroRecarga] = useState<string | null>(null);
  const [prevDeps, setPrevDeps] = useState(deps);
  const [prevHabilitado, setPrevHabilitado] = useState(habilitado);

  const contadorRef = useRef(0);

  // Ajuste durante a renderização quando deps ou habilitado mudam (padrão oficial React para resetar estado com novas props)
  const depsMudaram = deps.length !== prevDeps.length || deps.some((d, i) => !Object.is(d, prevDeps[i]));
  if (depsMudaram) {
    setPrevDeps(deps);
    setDados(null);
    setErro(null);
    setErroRecarga(null);
    if (habilitado) {
      setCarregandoInicial(true);
    }
  }

  if (habilitado !== prevHabilitado) {
    setPrevHabilitado(habilitado);
    if (!habilitado) {
      setCarregandoInicial(false);
    } else if (dados === null) {
      setCarregandoInicial(true);
    }
  }

  // Ao desabilitar: avança o contador em efeito para invalidar respostas em trânsito
  useEffect(() => {
    if (!habilitado) {
      contadorRef.current++;
    }
  }, [habilitado]);

  // Recarga em segundo plano: não altera carregandoInicial nem dados em caso de falha
  const recarregar = useCallback(async (): Promise<boolean> => {
    if (!habilitado) return false;
    const idRequisicao = ++contadorRef.current;
    try {
      const resultado = await buscar();
      if (idRequisicao !== contadorRef.current) {
        return false;
      }
      setDados(resultado);
      setErro(null);
      setErroRecarga(null);
      return true;
    } catch (error: unknown) {
      if (idRequisicao !== contadorRef.current) {
        return false;
      }
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setErro({
          tipo: 'nao_encontrado',
          mensagem: mensagemDeErro(error, mensagemPadrao || 'Recurso não encontrado.'),
        });
        setErroRecarga(null);
      } else {
        setErroRecarga(mensagemDeErro(error, mensagemPadrao || 'Erro ao atualizar dados.'));
      }
      return false;
    }
  }, [buscar, habilitado, mensagemPadrao]);

  const executarCarga = useCallback(
    (idRequisicao: number, ehRecarga = false) => {
      buscar()
        .then((resultado) => {
          if (idRequisicao !== contadorRef.current) return;
          setDados(resultado);
          setErro(null);
          setErroRecarga(null);
        })
        .catch((error: unknown) => {
          if (idRequisicao !== contadorRef.current) return;
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            setErro({
              tipo: 'nao_encontrado',
              mensagem: mensagemDeErro(error, mensagemPadrao || 'Recurso não encontrado.'),
            });
            setErroRecarga(null);
          } else if (ehRecarga) {
            setErroRecarga(mensagemDeErro(error, mensagemPadrao || 'Erro ao atualizar dados.'));
          } else {
            setErro({
              tipo: 'erro',
              mensagem: mensagemDeErro(error, mensagemPadrao || 'Erro ao carregar dados.'),
            });
            setDados(null);
          }
        })
        .finally(() => {
          if (idRequisicao === contadorRef.current && !ehRecarga) {
            setCarregandoInicial(false);
          }
        });
    },
    [buscar, mensagemPadrao],
  );

  // Carga inicial ou refazer chamada (acionado via botão na tela de erro)
  const tentarNovamente = useCallback(() => {
    if (!habilitado) return;
    setCarregandoInicial(true);
    setDados(null);
    setErro(null);
    setErroRecarga(null);
    const idRequisicao = ++contadorRef.current;
    executarCarga(idRequisicao, false);
  }, [executarCarga, habilitado]);

  // Efeito de carga inicial/recarga disparado na montagem ou na alteração de deps/habilitado
  useEffect(() => {
    if (!habilitado) return;

    const ehRecarga = dados !== null;
    const idRequisicao = ++contadorRef.current;
    executarCarga(idRequisicao, ehRecarga);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, habilitado]);

  return {
    dados,
    carregandoInicial,
    erro,
    erroRecarga,
    recarregar,
    tentarNovamente,
  };
}
