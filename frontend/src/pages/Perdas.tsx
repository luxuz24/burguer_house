import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';

type Motivo = 'VENCIMENTO' | 'ERRO_PREPARO' | 'ESTRAGADO' | 'OUTRO';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
}

interface Perda {
  id: string;
  quantidade: number;
  motivo: Motivo;
  criadoEm: string;
  insumo: Insumo;
}

interface ResumoMotivo {
  motivo: Motivo;
  quantidadeTotal: number;
  ocorrencias: number;
  valorTotal?: number;
}

const MOTIVOS: { id: Motivo; label: string; cor: string }[] = [
  { id: 'VENCIMENTO', label: 'Vencimento', cor: 'bg-orange-500 active:bg-orange-600' },
  { id: 'ERRO_PREPARO', label: 'Erro de preparo', cor: 'bg-yellow-500 active:bg-yellow-600' },
  { id: 'ESTRAGADO', label: 'Estragado', cor: 'bg-red-500 active:bg-red-600' },
  { id: 'OUTRO', label: 'Outro', cor: 'bg-gray-500 active:bg-gray-600' },
];

const rotulo = (m: Motivo) => MOTIVOS.find((x) => x.id === m)?.label ?? m;

export default function Perdas() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [perdas, setPerdas] = useState<Perda[]>([]);
  const [resumo, setResumo] = useState<ResumoMotivo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [ins, per, res] = await Promise.all([
        api.get('/insumos'),
        api.get('/perdas', { params: { limite: 10 } }),
        api.get('/perdas/resumo-mensal'),
      ]);
      setInsumos(ins.data);
      setPerdas(per.data);
      setResumo(res.data.porMotivo);
    } catch {
      console.error('Erro ao carregar dados de perdas');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const selecionado = insumos.find((i) => i.id === insumoId);
  const filtrados = insumos.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()));
  const qtdNumero = Number(quantidade);
  const podeRegistrar = !!selecionado && qtdNumero > 0 && !enviando;

  const { toast, confirmar } = useFeedback();

  const registrar = async (motivo: Motivo) => {
    if (!podeRegistrar || !selecionado) return;
    if (qtdNumero > selecionado.estoqueAtual) {
      const ok = await confirmar({
        titulo: 'Quantidade maior que o estoque',
        mensagem: `A quantidade a descartar (${qtdNumero} ${selecionado.unidade}) é maior que o estoque atual (${selecionado.estoqueAtual} ${selecionado.unidade}). Deseja confirmar mesmo assim?`,
        textoConfirmar: 'Confirmar descarte',
        perigoso: true,
      });
      if (!ok) return;
    }
    setEnviando(true);
    try {
      await api.post('/perdas', { insumoId, quantidade: qtdNumero, motivo });
      setQuantidade('');
      setConfirmado(true);
      setTimeout(() => setConfirmado(false), 1500);
      await carregar();
      toast.sucesso(`Perda de ${qtdNumero} ${selecionado.unidade} de "${selecionado.nome}" registrada.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao registrar perda.'));
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-colors">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Registro de Perdas</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. Insumo */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">1. Insumo</h2>
          <input
            placeholder="Buscar insumo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
            {filtrados.map((i) => (
              <button
                key={i.id}
                onClick={() => setInsumoId(i.id)}
                className={`p-3 rounded-xl border text-left text-sm font-medium transition-colors cursor-pointer ${
                  insumoId === i.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200'
                }`}
              >
                {i.nome}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Quantidade */}
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              2. Quantidade{selecionado ? ` (${selecionado.unidade})` : ''}
            </h2>
            {selecionado && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Estoque atual: <strong className="text-gray-800 dark:text-gray-200">{selecionado.estoqueAtual} {selecionado.unidade}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {[1, 10, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setQuantidade(String((Number(quantidade) || 0) + n))}
                className="flex-1 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-semibold text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer"
              >
                +{n}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Quantidade"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-full p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </section>

        {/* 3. Motivo (um toque registra) */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            3. Motivo — toque para registrar
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {MOTIVOS.map((m) => (
              <button
                key={m.id}
                disabled={!podeRegistrar}
                onClick={() => registrar(m.id)}
                className={`h-20 rounded-2xl text-white font-bold text-base shadow-sm disabled:opacity-40 cursor-pointer transition-transform active:scale-95 ${m.cor}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {confirmado && (
            <p className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 font-medium text-sm">
              <Check size={16} /> Perda registrada com sucesso
            </p>
          )}
        </section>

        {/* Resumo do mês */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Perdas do mês</h2>
          {resumo.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma perda registrada neste mês.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {resumo.map((r) => (
                <div key={r.motivo} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{rotulo(r.motivo)}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{r.ocorrencias} registro(s)</p>
                  {r.valorTotal !== undefined && r.valorTotal > 0 && (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      R$ {r.valorTotal.toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Histórico recente */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Últimos registros</h2>
          {perdas.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex justify-between text-sm">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{p.insumo.nome}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {rotulo(p.motivo)} • {new Date(p.criadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
              <p className="font-bold text-red-600 dark:text-red-400">
                -{p.quantidade} {p.insumo.unidade}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
