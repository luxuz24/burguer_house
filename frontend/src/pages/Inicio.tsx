import { useState, useEffect } from 'react';
import {
  QrCode,
  Trash2,
  Package,
  BarChart2,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';

interface KpisHoje {
  totalVendasValor: number;
  totalVendasQtd: number;
  totalComprasValor: number;
  totalComprasQtd: number;
  totalPerdasValor: number;
  totalPerdasQtd: number;
  insumosEmAlertaQtd: number;
}

interface InsumoAlerta {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  status: 'CRITICO' | 'ALERTA';
  percentualEstoque: number;
}

interface DadosHoje {
  kpis: KpisHoje;
  estoqueAlerta: InsumoAlerta[];
  itensMaisVendidos: Array<{ produtoNome: string; quantidadeVendida: number }>;
}

interface Props {
  onNavegar: (aba: string) => void;
  onAbrirImportarNota: () => void;
}

export default function Inicio({ onNavegar, onAbrirImportarNota }: Props) {
  const [dados, setDados] = useState<DadosHoje | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let montado = true;
    api.get<DadosHoje>('/dashboard/resumo', { params: { periodo: 'hoje' } })
      .then((res) => {
        if (montado) {
          setDados(res.data);
          setCarregando(false);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (montado) {
          setCarregando(false);
        }
      });

    return () => {
      montado = false;
    };
  }, []);

  const recarregar = () => {
    setCarregando(true);
    api.get<DadosHoje>('/dashboard/resumo', { params: { periodo: 'hoje' } })
      .then((res) => setDados(res.data))
      .catch(console.error)
      .finally(() => setCarregando(false));
  };

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Boas-Vindas e Status */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800/40">
              Operação em Andamento
            </span>
            <button
              onClick={recarregar}
              disabled={carregando}
              className="text-gray-400 hover:text-white transition-colors"
              title="Atualizar dados de hoje"
            >
              <RefreshCw size={16} className={carregando ? 'animate-spin text-blue-400' : ''} />
            </button>
          </div>

          <div>
            <h1 className="text-xl font-extrabold tracking-tight">BurgerStock</h1>
            <p className="text-xs text-gray-300 mt-0.5">
              Controle rápido de estoque, vendas e compras da cozinha
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-300">
            <Clock size={13} className="text-emerald-400" />
            <span>Consolidação noturna agendada para 23h15</span>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-4 translate-y-4">
          <Sparkles size={130} />
        </div>
      </div>

      {/* Ações Rápidas (One-Tap Actions) */}
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Scanner QR Code / Nota Fiscal */}
          <button
            type="button"
            onClick={onAbrirImportarNota}
            className="p-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl shadow-sm flex flex-col justify-between text-left transition-all hover:scale-[1.01]"
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <QrCode size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Ler QR Code</p>
              <p className="text-[11px] text-blue-100 mt-0.5">Importar NFC-e / NF-e</p>
            </div>
          </button>

          {/* Registrar Perda */}
          <button
            type="button"
            onClick={() => onNavegar('perdas')}
            className="p-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-2xl shadow-sm flex flex-col justify-between text-left transition-all hover:scale-[1.01]"
          >
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
              <Trash2 size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Registrar Perda</p>
              <p className="text-[11px] text-rose-100 mt-0.5">Baixa com 1 toque</p>
            </div>
          </button>

          {/* Estoque / Almoxarifado */}
          <button
            type="button"
            onClick={() => onNavegar('estoque')}
            className="p-3.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl shadow-sm flex flex-col justify-between text-left transition-all hover:scale-[1.01]"
          >
            <div className="w-9 h-9 bg-gray-100 text-gray-700 rounded-xl flex items-center justify-center mb-3">
              <Package size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Almoxarifado</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Insumos e produtos</p>
            </div>
          </button>

          {/* Gráficos e Relatórios */}
          <button
            type="button"
            onClick={() => onNavegar('relatorios')}
            className="p-3.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-2xl shadow-sm flex flex-col justify-between text-left transition-all hover:scale-[1.01]"
          >
            <div className="w-9 h-9 bg-gray-100 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
              <BarChart2 size={20} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Relatórios</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Gráficos executivos</p>
            </div>
          </button>
        </div>
      </div>

      {/* Snapshot de Hoje */}
      {carregando && !dados && (
        <div className="p-8 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={24} />
          <span>Carregando resumo do dia...</span>
        </div>
      )}

      {dados && (
        <>
          {/* Card Resumo do Dia */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Movimentação de Hoje
              </h3>
              <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-0.5">
                Em tempo real
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-gray-500 block">Vendas</span>
                <span className="font-bold text-gray-900 text-sm">
                  R$ {dados.kpis.totalVendasValor.toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  {dados.kpis.totalVendasQtd} ped.
                </span>
              </div>

              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-gray-500 block">Compras</span>
                <span className="font-bold text-gray-900 text-sm">
                  R$ {dados.kpis.totalComprasValor.toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  {dados.kpis.totalComprasQtd} notas
                </span>
              </div>

              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-[10px] text-gray-500 block">Perdas</span>
                <span className="font-bold text-rose-600 text-sm">
                  R$ {dados.kpis.totalPerdasValor.toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">
                  {dados.kpis.totalPerdasQtd} reg.
                </span>
              </div>
            </div>
          </div>

          {/* Alertas Críticos de Estoque */}
          {dados.estoqueAlerta.length > 0 && (
            <div className="bg-red-50/70 border border-red-200 p-4 rounded-2xl space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-red-700">
                  <ShieldAlert size={16} />
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    Atenção: Insumos Abaixo do Mínimo ({dados.estoqueAlerta.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavegar('estoque')}
                  className="text-xs font-bold text-red-700 hover:underline flex items-center gap-0.5"
                >
                  Ver <ArrowRight size={12} />
                </button>
              </div>

              <div className="space-y-1.5">
                {dados.estoqueAlerta.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-2.5 rounded-xl border border-red-100 flex justify-between items-center text-xs shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-gray-900">{item.nome}</span>
                      <p className="text-[11px] text-red-600 mt-0.5">
                        Restam {item.estoqueAtual} {item.unidade} (Mín: {item.estoqueMinimo})
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onAbrirImportarNota}
                      className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      Repor
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Destaque para Relatórios */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart2 size={20} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Dashboard Analítico Completo</p>
                <p className="text-xs text-gray-500">Gráficos de custos por fornecedor e perdas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavegar('relatorios')}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
            >
              Abrir <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
