import { useState, useEffect, useCallback, useRef } from 'react';
import type { DependencyList } from 'react';
import { mensagemDeErro } from '../lib/api';

export type ErroCarregamento = { tipo: 'nao_encontrado' | 'erro'; mensagem: string };

export interface OpcoesCarregamento {
  mensagemPadrao?: string;
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
  const [dados, setDados] = useState<T | null>(null);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erro, setErro] = useState<ErroCarregamento | null>(null);
  const [erroRecarga, setErroRecarga] = useState<string | null>(null);
  const [prevDeps, setPrevDeps] = useState(deps);

  const contadorRef = useRef(0);
  const mensagemPadrao = opcoes?.mensagemPadrao;

  // Ajuste durante a renderização quando deps mudam (padrão oficial React para resetar estado com novas props)
  const depsMudaram = deps.length !== prevDeps.length || deps.some((d, i) => !Object.is(d, prevDeps[i]));
  if (depsMudaram) {
    setPrevDeps(deps);
    setDados(null);
    setCarregandoInicial(true);
    setErro(null);
    setErroRecarga(null);
  }

  // Recarga em segundo plano: não altera carregandoInicial nem dados em caso de falha
  const recarregar = useCallback(async (): Promise<boolean> => {
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
  }, [buscar, mensagemPadrao]);

  const executarCarga = useCallback(
    (idRequisicao: number) => {
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
          } else {
            setErro({
              tipo: 'erro',
              mensagem: mensagemDeErro(error, mensagemPadrao || 'Erro ao carregar dados.'),
            });
          }
          setDados(null);
        })
        .finally(() => {
          if (idRequisicao === contadorRef.current) {
            setCarregandoInicial(false);
          }
        });
    },
    [buscar, mensagemPadrao],
  );

  // Carga inicial ou refazer chamada (acionado via botão na tela de erro)
  const tentarNovamente = useCallback(() => {
    setCarregandoInicial(true);
    setDados(null);
    setErro(null);
    setErroRecarga(null);
    const idRequisicao = ++contadorRef.current;
    executarCarga(idRequisicao);
  }, [executarCarga]);

  // Efeito de carga inicial disparado na montagem ou na alteração de deps
  useEffect(() => {
    const idRequisicao = ++contadorRef.current;
    executarCarga(idRequisicao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    dados,
    carregandoInicial,
    erro,
    erroRecarga,
    recarregar,
    tentarNovamente,
  };
}
