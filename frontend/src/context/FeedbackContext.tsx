import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Portal from '../components/ui/Portal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CheckCircle, XCircle, Info, WarningCircle, X, type Icon } from '../components/ui/icons';

type ToastTipo = 'sucesso' | 'erro' | 'info' | 'aviso';

interface Toast {
  id: number;
  tipo: ToastTipo;
  mensagem: string;
}

interface ConfirmOpcoes {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigoso?: boolean;
}

interface ConfirmacaoNaFila {
  id: number;
  opcoes: ConfirmOpcoes;
}

interface FeedbackContextType {
  toast: {
    sucesso: (mensagem: string) => void;
    erro: (mensagem: string) => void;
    info: (mensagem: string) => void;
    aviso: (mensagem: string) => void;
  };
  confirmar: (opcoes: ConfirmOpcoes | string) => Promise<boolean>;
  /**
   * Uso exclusivo do ciclo de vida da aplicação (App / MainApp): cancela confirmações pendentes
   * resolvendo com false ao encerrar a sessão. Telas e componentes comuns devem usar apenas `confirmar` e `toast`.
   */
  cancelarConfirmacoes: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

const VARIANTES_MAP: Record<ToastTipo, { icone: Icon; border: string; iconColor: string; bgSoft: string }> = {
  sucesso: {
    icone: CheckCircle,
    border: 'border-success/30',
    iconColor: 'text-success',
    bgSoft: 'bg-success-soft',
  },
  erro: {
    icone: XCircle,
    border: 'border-danger/30',
    iconColor: 'text-danger',
    bgSoft: 'bg-danger-soft',
  },
  info: {
    icone: Info,
    border: 'border-secondary/30',
    iconColor: 'text-secondary',
    bgSoft: 'bg-secondary-soft',
  },
  aviso: {
    icone: WarningCircle,
    border: 'border-primary/40',
    iconColor: 'text-brand',
    bgSoft: 'bg-primary-soft',
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Confirmações pedidas enquanto outra está aberta esperam na fila (antes, a segunda sobrescrevia a primeira
  // e a promise da primeira nunca resolvia). Cada resposta é ligada ao id do diálogo que a recebeu.
  const [filaConfirmacoes, setFilaConfirmacoes] = useState<ConfirmacaoNaFila[]>([]);
  const resolvedoresRef = useRef(new Map<number, (valor: boolean) => void>());
  const proximoId = useRef(0);
  const timersToasts = useRef(new Set<ReturnType<typeof setTimeout>>());
  const reduce = useReducedMotion();

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const adicionar = useCallback(
    (tipo: ToastTipo, mensagem: string) => {
      const id = ++proximoId.current;
      setToasts((atual) => [...atual.slice(-3), { id, tipo, mensagem }]);
      const timer = setTimeout(() => {
        timersToasts.current.delete(timer);
        remover(id);
      }, tipo === 'erro' ? 5000 : 3500);
      timersToasts.current.add(timer);
    },
    [remover]
  );

  const confirmar = useCallback((opcoes: ConfirmOpcoes | string) => {
    const id = ++proximoId.current;
    const normalizadas = typeof opcoes === 'string' ? { mensagem: opcoes } : opcoes;
    return new Promise<boolean>((resolve) => {
      resolvedoresRef.current.set(id, resolve);
      setFilaConfirmacoes((fila) => [...fila, { id, opcoes: normalizadas }]);
    });
  }, []);

  // Responde só o diálogo `id`: um segundo clique no mesmo botão não alcança o próximo da fila
  const responder = useCallback((id: number, valor: boolean) => {
    const resolver = resolvedoresRef.current.get(id);
    if (!resolver) return;
    resolvedoresRef.current.delete(id);
    resolver(valor);
    setFilaConfirmacoes((fila) => fila.filter((c) => c.id !== id));
  }, []);

  // Provider desmontado (ex.: árvore trocada) com diálogos pendentes: ninguém fica esperando para sempre.
  // Os timers dos toasts também são cancelados.
  useEffect(() => {
    const resolvedores = resolvedoresRef.current;
    const timers = timersToasts.current;
    return () => {
      resolvedores.forEach((resolver) => resolver(false));
      resolvedores.clear();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const cancelarConfirmacoes = useCallback(() => {
    resolvedoresRef.current.forEach((resolver) => resolver(false));
    resolvedoresRef.current.clear();
    setFilaConfirmacoes([]);
  }, []);

  const confirmacaoAtual = filaConfirmacoes[0];

  const toast = useMemo(
    () => ({
      sucesso: (m: string) => adicionar('sucesso', m),
      erro: (m: string) => adicionar('erro', m),
      info: (m: string) => adicionar('info', m),
      aviso: (m: string) => adicionar('aviso', m),
    }),
    [adicionar]
  );

  const value = useMemo(
    () => ({ toast, confirmar, cancelarConfirmacoes }),
    [toast, confirmar, cancelarConfirmacoes]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Pilha de toasts acima da barra inferior: no topo eles cobriam o título das telas */}
      <Portal>
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] inset-x-0 z-[70] flex flex-col items-center gap-2 px-3 pointer-events-none"
        >
          <AnimatePresence mode="popLayout">
            {toasts.map(({ id, tipo, mensagem }) => {
              const item = VARIANTES_MAP[tipo];
              const IconComponent = item.icone;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`pointer-events-auto flex items-center gap-3 w-full max-w-sm p-3.5 rounded-2xl bg-card border ${item.border} shadow-[var(--shadow-float)]`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-xl ${item.bgSoft} flex items-center justify-center ${item.iconColor}`}>
                    <IconComponent size={20} weight="fill" />
                  </div>
                  <p className="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-ink leading-snug">
                    {mensagem}
                  </p>
                  <button
                    type="button"
                    onClick={() => remover(id)}
                    aria-label="Fechar notificação"
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-field transition cursor-pointer"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </Portal>

      {/* Diálogo de confirmação usando ConfirmDialog / Sheet */}
      {confirmacaoAtual && (
        <ConfirmDialog
          key={confirmacaoAtual.id}
          open={true}
          onClose={() => responder(confirmacaoAtual.id, false)}
          onConfirm={() => responder(confirmacaoAtual.id, true)}
          title={confirmacaoAtual.opcoes.titulo ?? 'Confirmar ação'}
          description={confirmacaoAtual.opcoes.mensagem}
          confirmLabel={confirmacaoAtual.opcoes.textoConfirmar ?? 'Confirmar'}
          cancelLabel={confirmacaoAtual.opcoes.textoCancelar ?? 'Cancelar'}
          confirmVariant={confirmacaoAtual.opcoes.perigoso ? 'danger' : 'primary'}
        />
      )}
    </FeedbackContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback deve ser usado dentro de um FeedbackProvider');
  }
  return context;
}
