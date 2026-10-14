import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

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

const estilos: Record<ToastTipo, { classe: string; Icone: typeof Info }> = {
  sucesso: {
    classe: 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    Icone: CheckCircle2,
  },
  erro: {
    classe: 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
    Icone: AlertCircle,
  },
  info: {
    classe: 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    Icone: Info,
  },
  aviso: {
    classe: 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    Icone: AlertTriangle,
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmacao, setConfirmacao] = useState<ConfirmOpcoes | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);
  const proximoId = useRef(0);

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

  const toast = {
    sucesso: (m: string) => adicionar('sucesso', m),
    erro: (m: string) => adicionar('erro', m),
    info: (m: string) => adicionar('info', m),
    aviso: (m: string) => adicionar('aviso', m),
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirmar }}>
      {children}

      {/* Pilha de toasts — topo, centralizada na largura do app mobile */}
      <div className="fixed top-3 inset-x-0 z-[70] flex flex-col items-center gap-2 px-3 pointer-events-none">
        {toasts.map(({ id, tipo, mensagem }) => {
          const { classe, Icone } = estilos[tipo];
          return (
            <div
              key={id}
              role="status"
              className={`pointer-events-auto w-full max-w-sm flex items-start gap-2.5 p-3 rounded-2xl border shadow-lg text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${classe}`}
            >
              <Icone size={16} className="shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{mensagem}</span>
              <button
                type="button"
                onClick={() => remover(id)}
                className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
                aria-label="Fechar notificação"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Diálogo de confirmação */}
      {confirmacao && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-5 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {confirmacao.titulo ?? 'Confirmar ação'}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed whitespace-pre-line">
              {confirmacao.mensagem}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => responder(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                {confirmacao.textoCancelar ?? 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => responder(true)}
                className={`flex-1 py-2.5 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer ${
                  confirmacao.perigoso
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmacao.textoConfirmar ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
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
