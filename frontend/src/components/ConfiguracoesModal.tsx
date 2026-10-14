import { useState } from 'react';
import { X, Moon, Sun, Monitor, Bell, Clock, Store, ShieldCheck, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

export default function ConfiguracoesModal({ aberto, onFechar }: Props) {
  const { theme, setTheme } = useTheme();

  const [alertaEstoque, setAlertaEstoque] = useState(() => {
    return localStorage.getItem('cfg_alerta_estoque') !== 'false';
  });

  const [alertaValidade, setAlertaValidade] = useState(() => {
    return localStorage.getItem('cfg_alerta_validade') !== 'false';
  });

  const [somScanner, setSomScanner] = useState(() => {
    return localStorage.getItem('cfg_som_scanner') !== 'false';
  });

  const [salvo, setSalvo] = useState(false);

  if (!aberto) return null;

  const salvarConfiguracoes = () => {
    localStorage.setItem('cfg_alerta_estoque', String(alertaEstoque));
    localStorage.setItem('cfg_alerta_validade', String(alertaValidade));
    localStorage.setItem('cfg_som_scanner', String(somScanner));
    setSalvo(true);
    setTimeout(() => {
      setSalvo(false);
      onFechar();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header do Modal */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Configurações</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Preferências do sistema e do operador</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-4 overflow-y-auto space-y-5 text-xs text-gray-700 dark:text-gray-300">
          {/* Seção 1: Tema (Modo Dark / Claro / Sistema) */}
          <div className="space-y-2">
            <label className="font-bold text-gray-900 dark:text-white block uppercase tracking-wider text-[11px]">
              Tema da Interface
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Sun size={18} />
                <span>Claro</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  theme === 'dark'
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Moon size={18} />
                <span>Escuro</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  theme === 'system'
                    ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold shadow-xs'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <Monitor size={18} />
                <span>Automático</span>
              </button>
            </div>
          </div>

          {/* Seção 2: Alertas Operacionais */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold text-[11px] uppercase tracking-wider">
              <Bell size={14} className="text-amber-500" />
              <span>Alertas e Notificações</span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-xs">Alerta de Estoque Mínimo</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Exibir badge e aviso quando insumo estiver acabando</p>
                </div>
                <input
                  type="checkbox"
                  checked={alertaEstoque}
                  onChange={(e) => setAlertaEstoque(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-xs">Aviso de Validade Próxima</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Itens beneficiados a 2 dias ou menos do vencimento</p>
                </div>
                <input
                  type="checkbox"
                  checked={alertaValidade}
                  onChange={(e) => setAlertaValidade(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-xs">Biometria / Bip do Scanner</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Vibração e som ao ler QR Code de NFC-e</p>
                </div>
                <input
                  type="checkbox"
                  checked={somScanner}
                  onChange={(e) => setSomScanner(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Seção 3: Horários e Rotinas da Hamburgueria */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold text-[11px] uppercase tracking-wider">
              <Clock size={14} className="text-blue-500" />
              <span>Rotinas Automatizadas (Cron)</span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Aquecimento da API (Neon / Koyeb)</p>
                  <p className="text-[11px] text-gray-500">Quarta a Domingo, às 17:50</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Ativo
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Consolidação de Estoque Noturna</p>
                  <p className="text-[11px] text-gray-500">Quarta a Domingo, às 23:15</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  Ativo
                </span>
              </div>
            </div>
          </div>

          {/* Seção 4: Dados da Loja */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold text-[11px] uppercase tracking-wider">
              <Store size={14} className="text-emerald-500" />
              <span>Unidade e Integrações</span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Empresa:</span>
                <span className="font-bold text-gray-900 dark:text-white">Burguer House Lanches LTDA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CNPJ:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">12.345.678/0001-90</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Anota AI Webhook:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> Conectado (200 OK)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Salvar */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-xs transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={salvarConfiguracoes}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            {salvo ? (
              <>
                <Check size={14} /> Salvo!
              </>
            ) : (
              'Salvar Preferências'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
