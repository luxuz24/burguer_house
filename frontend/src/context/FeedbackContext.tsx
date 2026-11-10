import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
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

interface FeedbackContextType {
  toast: {
    sucesso: (mensagem: string) => void;
    erro: (mensagem: string) => void;
    info: (mensagem: string) => void;
    aviso: (mensagem: string) => void;
  };
  confirmar: (opcoes: ConfirmOpcoes | string) => Promise<boolean>;
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
  const [confirmacao, setConfirmacao] = useState<ConfirmOpcoes | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);
  const proximoId = useRef(0);
  const reduce = useReducedMotion();

  const remover = useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const adicionar = useCallback(
    (tipo: ToastTipo, mensagem: string) => {
      const id = ++proximoId.current;
      setToasts((atual) => [...atual.slice(-3), { id, tipo, mensagem }]);
      setTimeout(() => remover(id), tipo === 'erro' ? 5000 : 3500);
    },
    [remover]
  );

  const confirmar = useCallback((opcoes: ConfirmOpcoes | string) => {
    setConfirmacao(typeof opcoes === 'string' ? { mensagem: opcoes } : opcoes);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const responder = (valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setConfirmacao(null);
  };

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
    () => ({ toast, confirmar }),
    [toast, confirmar]
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
      {confirmacao && (
        <ConfirmDialog
          open={true}
          onClose={() => responder(false)}
          onConfirm={() => responder(true)}
          title={confirmacao.titulo ?? 'Confirmar ação'}
          description={confirmacao.mensagem}
          confirmLabel={confirmacao.textoConfirmar ?? 'Confirmar'}
          cancelLabel={confirmacao.textoCancelar ?? 'Cancelar'}
          confirmVariant={confirmacao.perigoso ? 'danger' : 'primary'}
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
