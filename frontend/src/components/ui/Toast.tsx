import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Portal from './Portal';
import { CheckCircle, XCircle, Info, WarningCircle, X, type Icon } from './icons';

export type ToastVariant = 'success' | 'danger' | 'info' | 'warning';

export interface ToastItem {
  readonly id: string;
  readonly message: string;
  readonly variant: ToastVariant;
  readonly duration?: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICONS: Record<ToastVariant, Icon> = {
  success: CheckCircle,
  danger: XCircle,
  info: Info,
  warning: WarningCircle,
};

const VARIANT_STYLES: Record<ToastVariant, { border: string; iconColor: string; bgSoft: string }> = {
  success: {
    border: 'border-success/30',
    iconColor: 'text-success',
    bgSoft: 'bg-success-soft',
  },
  danger: {
    border: 'border-danger/30',
    iconColor: 'text-danger',
    bgSoft: 'bg-danger-soft',
  },
  info: {
    border: 'border-secondary/30',
    iconColor: 'text-secondary',
    bgSoft: 'bg-secondary-soft',
  },
  warning: {
    border: 'border-primary/40',
    iconColor: 'text-brand',
    bgSoft: 'bg-primary-soft',
  },
};

export const ToastProvider: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<readonly ToastItem[]>([]);
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration: number = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: ToastItem = { id, message, variant, duration };
    setToasts((prev) => [...prev, newItem]);

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  const success = useCallback((msg: string, d?: number) => show(msg, 'success', d), [show]);
  const error = useCallback((msg: string, d?: number) => show(msg, 'danger', d), [show]);
  const info = useCallback((msg: string, d?: number) => show(msg, 'info', d), [show]);
  const warning = useCallback((msg: string, d?: number) => show(msg, 'warning', d), [show]);

  const contextValue = useMemo<ToastContextValue>(() => ({
    show,
    success,
    error,
    info,
    warning,
    dismiss,
  }), [show, success, error, info, warning, dismiss]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Portal>
        <div
          role="status"
          aria-live="polite"
          aria-relevant="additions"
          className="fixed bottom-0 left-0 right-0 z-[70] pointer-events-none p-4 pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col items-center gap-2"
        >
          <AnimatePresence mode="popLayout">
            {toasts.map((t) => {
              const IconComponent = VARIANT_ICONS[t.variant];
              const styles = VARIANT_STYLES[t.variant];

              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`pointer-events-auto flex items-center gap-3 w-full max-w-sm p-3.5 rounded-2xl bg-card border ${styles.border} shadow-[var(--shadow-float)]`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-xl ${styles.bgSoft} flex items-center justify-center ${styles.iconColor}`}>
                    <IconComponent size={20} weight="fill" />
                  </div>
                  <p className="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-ink leading-snug">
                    {t.message}
                  </p>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
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
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser utilizado dentro de um ToastProvider');
  }
  return ctx;
}

export default ToastProvider;
