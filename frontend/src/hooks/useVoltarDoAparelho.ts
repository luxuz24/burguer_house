import { useEffect, useRef } from 'react';

/**
 * Integra as subtelas de tela cheia (e a câmera do leitor de QR) com o botão/gesto Voltar do celular.
 *
 * Sem isso o Voltar do aparelho volta o navegador e tira o usuário do app, porque as subtelas abrem só
 * por estado do React. Cada camada aberta empilha uma entrada no histórico (`pushState`); o `popstate`
 * chama o `aoVoltar` da camada de cima, que decide se fecha (ex.: pedir confirmação de descarte).
 *
 * - A entrada é devolvida ao histórico antes de chamar `aoVoltar`: se a tela não fechar (confirmação
 *   cancelada), o próximo Voltar continua protegido. Se fechar, a limpeza do hook a remove.
 * - Fechar pela própria tela (botão "Voltar") também remove a entrada, sem deixar Voltar "morto".
 * - Remover uma camada remove junto as que estão acima dela (ex.: sair da Importar NF-e com a câmera aberta).
 * - A remoção espera um microtask: o StrictMode desmonta e remonta o efeito na hora, e a remontagem
 *   reaproveita a mesma entrada em vez de mexer no histórico.
 */

interface Camada {
  id: number;
  aoVoltar: () => void;
}

const pilha: Camada[] = [];
let proximoId = 1;
let ouvindo = false;

function aoPopstate(evento: PopStateEvent) {
  const topo = pilha[pilha.length - 1];
  if (!topo) return;
  // Caiu na própria entrada da camada de cima: foi o history.go() do hook ao remover camadas, não o usuário.
  // (Comparar o estado, e não contar eventos, aguenta um history.go() que o navegador cancele no meio.)
  const idAtual = (evento.state as { camadaVoltar?: number } | null)?.camadaVoltar;
  if (idAtual === topo.id) return;
  window.history.pushState({ camadaVoltar: topo.id }, '');
  topo.aoVoltar();
}

function garantirOuvinte() {
  if (ouvindo) return;
  window.addEventListener('popstate', aoPopstate);
  ouvindo = true;
}

function removerCamada(id: number) {
  const indice = pilha.findIndex((c) => c.id === id);
  if (indice < 0) return;
  const quantidade = pilha.length - indice;
  pilha.splice(indice);
  window.history.go(-quantidade);
}

export function useVoltarDoAparelho(ativo: boolean, aoVoltar: () => void) {
  const aoVoltarRef = useRef(aoVoltar);
  useEffect(() => {
    aoVoltarRef.current = aoVoltar;
  });

  const camadaRef = useRef<{ id: number; removerPendente: boolean } | null>(null);

  useEffect(() => {
    if (!ativo) return;
    garantirOuvinte();

    const existente = camadaRef.current;
    if (existente?.removerPendente) {
      // Remontagem imediata (StrictMode): a camada continua a mesma.
      existente.removerPendente = false;
    } else {
      const id = proximoId++;
      pilha.push({ id, aoVoltar: () => aoVoltarRef.current() });
      window.history.pushState({ camadaVoltar: id }, '');
      camadaRef.current = { id, removerPendente: false };
    }

    return () => {
      const camada = camadaRef.current;
      if (!camada) return;
      camada.removerPendente = true;
      queueMicrotask(() => {
        if (!camada.removerPendente) return;
        if (camadaRef.current === camada) camadaRef.current = null;
        removerCamada(camada.id);
      });
    };
  }, [ativo]);
}
