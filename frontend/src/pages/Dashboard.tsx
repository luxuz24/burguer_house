import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Calendar,
  Package,
  Layers,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../lib/api';

interface Kpis {
  totalVendasValor: number;
  totalVendasQtd: number;
  totalComprasValor: number;
  totalComprasQtd: number;
  totalPerdasValor: number;
  totalPerdasQtd: number;
  insumosEmAlertaQtd: number;
}

interface PerdaMotivo {
  motivo: string;
  label: string;
  valorTotal: number;
  quantidadeTotal: number;
  totalOcorrencias: number;
  percentual: number;
}

interface ConsumoInsumo {
  insumoId: string;
  nome: string;
  unidade: string;
  quantidadeConsumida: number;
  valorEstimado: number;
}

interface ItemMaisVendido {
  produtoNome: string;
  quantidadeVendida: number;
  valorEstimadoTotal: number;
}

interface EstoqueAlerta {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  status: 'CRITICO' | 'ALERTA';
  percentualEstoque: number;
  diasRestantesValidade?: number;
  vencido?: boolean;
}

interface ComprasFornecedor {
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  totalNotas: number;
  percentual: number;
}

interface ResumoDashboard {
  periodo: {
    tipo: string;
    dataInicio: string;
    dataFim: string;
  };
  kpis: Kpis;
  perdasPorMotivo: PerdaMotivo[];
  consumoInsumos: ConsumoInsumo[];
  itensMaisVendidos: ItemMaisVendido[];
  estoqueAlerta: EstoqueAlerta[];
  comprasPorFornecedor: ComprasFornecedor[];
}

const CORES_MOTIVOS: Record<string, string> = {
  VENCIMENTO: '#EF4444', // Vermelho
  ERRO_PREPARO: '#F59E0B', // Amarelo/Laranja
  ESTRAGADO: '#8B5CF6', // Roxo
  OUTRO: '#6B7280', // Cinza
};

const CORES_PIE = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#6366F1'];

export default function Dashboard() {
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('mes');
  const [dados, setDados] = useState<ResumoDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDashboard = useCallback(() => {
    setCarregando(true);
    setErro(null);
    api.get<ResumoDashboard>('/dashboard/resumo', {
      params: { periodo },
    })
      .then((res) => {
        setDados(res.data);
      })
      .catch((err: unknown) => {
        console.error(err);
        const errorMsg = err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
        setErro(errorMsg || 'Não foi possível carregar o dashboard.');
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [periodo]);

  useEffect(() => {
    let montado = true;
    api.get<ResumoDashboard>('/dashboard/resumo', {
      params: { periodo },
    })
      .then((res) => {
        if (montado) {
          setDados(res.data);
          setCarregando(false);
        }
      })
      .catch((err: unknown) => {
        if (montado) {
          console.error(err);
          const errorMsg = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : undefined;
          setErro(errorMsg || 'Não foi possível carregar o dashboard.');
          setCarregando(false);
        }
      });

    return () => {
      montado = false;
    };
  }, [periodo]);

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* Top Header & Seletor de Período */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Painel Executivo</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Resumo financeiro e operacional da cozinha</p>
          </div>
          <button
            onClick={carregarDashboard}
            disabled={carregando}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw size={18} className={carregando ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>

        {/* Abas de Período */}
        <div className="flex bg-gray-200 dark:bg-gray-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setPeriodo('mes')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              periodo === 'mes'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Calendar size={13} /> Este Mês
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              periodo === 'semana'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            7 Dias
          </button>
          <button
            onClick={() => setPeriodo('hoje')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
              periodo === 'hoje'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Hoje
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center justify-between">
          <span>{erro}</span>
          <button onClick={carregarDashboard} className="underline font-bold text-xs ml-2 cursor-pointer">
            Tentar novamente
          </button>
        </div>
      )}

      {carregando && !dados && (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-gray-400">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-xs">Consolidando métricas em tempo real...</p>
        </div>
      )}

      {dados && (
        <>
          {/* 1. KPIs Principais (Resumo Executivo) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Vendas */}
            <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Vendas do Período
                </span>
                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                R$ {dados.kpis.totalVendasValor.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <ShoppingCart size={11} /> {dados.kpis.totalVendasQtd} pedidos consolidados
              </p>
            </div>

            {/* Compras de Insumos */}
            <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Compras (NF-e/NFC-e)
                </span>
                <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-lg">
                  <DollarSign size={16} />
                </div>
              </div>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                R$ {dados.kpis.totalComprasValor.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <Truck size={11} /> {dados.kpis.totalComprasQtd} notas registradas
              </p>
            </div>

            {/* Perdas e Desperdício */}
            <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Desperdício / Perdas
                </span>
                <div className="p-1.5 bg-rose-50 dark:bg-rose-950/60 rounded-lg">
                  <AlertTriangle size={16} />
                </div>
              </div>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                R$ {dados.kpis.totalPerdasValor.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {dados.kpis.totalPerdasQtd} registros de perda
              </p>
            </div>

            {/* Insumos em Alerta */}
            <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Alertas de Estoque
                </span>
                <div className="p-1.5 bg-amber-50 dark:bg-amber-950/60 rounded-lg">
                  <Package size={16} />
                </div>
              </div>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                {dados.kpis.insumosEmAlertaQtd}{' '}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  {dados.kpis.insumosEmAlertaQtd === 1 ? 'item' : 'itens'}
                </span>
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {dados.kpis.insumosEmAlertaQtd > 0 ? 'Abaixo do mínimo ou validade' : 'Estoque regular'}
              </p>
            </div>
          </div>

          {/* 2. Gráfico: Onde o Dinheiro Está Sendo Perdiço (Perdas por Motivo) */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-rose-500" /> Perdas por Motivo
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Onde o dinheiro está sendo jogado fora?</p>
              </div>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg">
                R$ {dados.kpis.totalPerdasValor.toFixed(2)}
              </span>
            </div>

            {dados.kpis.totalPerdasQtd > 0 ? (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dados.perdasPorMotivo.filter((m) => m.totalOcorrencias > 0 || m.valorTotal > 0)}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) => (dados.kpis.totalPerdasValor > 0 ? `R$${v}` : `${v}`)}
                        fontSize={10}
                        stroke="#9CA3AF"
                      />
                      <YAxis type="category" dataKey="label" width={90} fontSize={11} stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.75rem', color: '#F9FAFB' }}
                        formatter={(valor) =>
                          dados.kpis.totalPerdasValor > 0
                            ? [`R$ ${Number(valor || 0).toFixed(2)}`, 'Custo']
                            : [`${Number(valor || 0)} ocorrência(s)`, 'Registros']
                        }
                      />
                      <Bar dataKey={dados.kpis.totalPerdasValor > 0 ? 'valorTotal' : 'totalOcorrencias'} radius={[0, 6, 6, 0]}>
                        {dados.perdasPorMotivo
                          .filter((m) => m.totalOcorrencias > 0 || m.valorTotal > 0)
                          .map((entry) => (
                            <Cell
                              key={entry.motivo}
                              fill={CORES_MOTIVOS[entry.motivo] || '#6B7280'}
                            />
                          ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda de Motivos com Percentual */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-gray-800 text-xs">
                  {dados.perdasPorMotivo.map((m) => (
                    <div key={m.motivo} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CORES_MOTIVOS[m.motivo] || '#6B7280' }}
                        ></span>
                        {m.label}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-200 ml-1">
                        {m.percentual}% ({m.totalOcorrencias})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                Nenhuma perda registrada neste período!
              </div>
            )}
          </div>

          {/* 3. Gráfico: Itens Mais Vendidos */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp size={16} className="text-emerald-500" /> Itens Mais Vendidos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                O que vale a pena manter sempre em estoque?
              </p>
            </div>

            {dados.itensMaisVendidos.length > 0 ? (
              <div className="space-y-2.5">
                {dados.itensMaisVendidos.slice(0, 5).map((item, index) => {
                  const maxQtd = dados.itensMaisVendidos[0]?.quantidadeVendida || 1;
                  const pct = Math.round((item.quantidadeVendida / maxQtd) * 100);

                  return (
                    <div key={item.produtoNome} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {index + 1}. {item.produtoNome}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {item.quantidadeVendida} un{' '}
                          {item.valorEstimadoTotal > 0 && (
                            <span className="text-gray-400 dark:text-gray-500 font-normal">
                              (R$ {item.valorEstimadoTotal.toFixed(2)})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs">
                Nenhuma venda consolidada neste período.
              </div>
            )}
          </div>

          {/* 4. Gráfico: Custo de Compras por Fornecedor */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Truck size={16} className="text-blue-500" /> Custo de Compras por Fornecedor
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">De onde vem o maior custo de insumos?</p>
            </div>

            {dados.comprasPorFornecedor.length > 0 ? (
              <>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dados.comprasPorFornecedor}
                        dataKey="valorTotal"
                        nameKey="fornecedorNome"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {dados.comprasPorFornecedor.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CORES_PIE[index % CORES_PIE.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', borderRadius: '0.75rem', color: '#F9FAFB' }}
                        formatter={(valor) => [`R$ ${Number(valor || 0).toFixed(2)}`, 'Total']}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs pt-1">
                  {dados.comprasPorFornecedor.map((forn, idx) => (
                    <div key={forn.fornecedorNome} className="py-2 flex justify-between items-center">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CORES_PIE[idx % CORES_PIE.length] }}
                        ></div>
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {forn.fornecedorNome}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900 dark:text-white">
                          R$ {forn.valorTotal.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {forn.percentual}% ({forn.totalNotas} {forn.totalNotas === 1 ? 'nota' : 'notas'})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs">
                Nenhuma nota fiscal registrada no período.
              </div>
            )}
          </div>

          {/* 5. Consumo de Insumos (Quais insumos giram mais rápido) */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Layers size={16} className="text-indigo-500" /> Giro e Consumo de Insumos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Quais insumos mais giraram através das fichas técnicas?
              </p>
            </div>

            {dados.consumoInsumos.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {dados.consumoInsumos.slice(0, 6).map((ins) => (
                  <div key={ins.insumoId} className="py-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{ins.nome}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Consumo estimado: <strong>{ins.quantidadeConsumida} {ins.unidade}</strong>
                      </p>
                    </div>
                    {ins.valorEstimado > 0 && (
                      <span className="font-bold text-gray-900 dark:text-white text-xs bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-lg">
                        R$ {ins.valorEstimado.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 text-xs">
                Nenhum insumo baixado por vendas no período.
              </div>
            )}
          </div>

          {/* 6. Estoque Atual vs Mínimo (O que está prestes a faltar) */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Package size={16} className="text-amber-500" /> Alertas de Estoque Mínimo
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">O que está prestes a faltar?</p>
              </div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg">
                {dados.estoqueAlerta.length} itens em risco
              </span>
            </div>

            {dados.estoqueAlerta.length > 0 ? (
              <div className="space-y-2.5">
                {dados.estoqueAlerta.map((ins) => (
                  <div
                    key={ins.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      ins.status === 'CRITICO'
                        ? 'bg-red-50/60 dark:bg-red-950/40 border-red-200 dark:border-red-900/60'
                        : 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900 dark:text-white">{ins.nome}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ins.status === 'CRITICO'
                              ? 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {ins.status === 'CRITICO' ? 'Crítico' : 'Atenção'}
                        </span>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                        Atual: <strong className="text-gray-800 dark:text-gray-200">{ins.estoqueAtual} {ins.unidade}</strong> • Mínimo ideal: {ins.estoqueMinimo} {ins.unidade}
                      </p>
                      {ins.vencido !== undefined && (
                        <p className={`text-[11px] font-semibold mt-0.5 ${ins.vencido ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {ins.vencido
                            ? `Vencido há ${Math.abs(ins.diasRestantesValidade || 0)} dia(s)`
                            : `Perto de vencer (${ins.diasRestantesValidade} dia(s))`}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-xs text-gray-700 dark:text-gray-300">
                        {ins.percentualEstoque}%
                      </span>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">do mínimo</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-gray-400 text-xs flex flex-col items-center gap-1">
                <CheckCircle2 size={24} className="text-emerald-500" />
                Todos os insumos estão com estoque acima do limite mínimo!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
