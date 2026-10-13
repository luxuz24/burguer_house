import { useState, useEffect, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';
import { api } from '../lib/api';

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

  const registrar = async (motivo: Motivo) => {
    if (!podeRegistrar) return;
    setEnviando(true);
    try {
      await api.post('/perdas', { insumoId, quantidade: qtdNumero, motivo });
      setQuantidade('');
      setConfirmado(true);
      setTimeout(() => setConfirmado(false), 1500);
      await carregar();
    } catch {
      alert('Erro ao registrar perda.');
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
    <div className="flex flex-col min-h-full pb-20 bg-gray-50">
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-200 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Registro de Perdas</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* 1. Insumo */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">1. Insumo</h2>
          <input
            placeholder="Buscar insumo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full p-3 border rounded-xl bg-white"
          />
          <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
            {filtrados.map((i) => (
              <button
                key={i.id}
                onClick={() => setInsumoId(i.id)}
                className={`p-3 rounded-xl border text-left text-sm font-medium ${
                  insumoId === i.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                {i.nome}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Quantidade */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            2. Quantidade{selecionado ? ` (${selecionado.unidade})` : ''}
          </h2>
          <div className="flex gap-2">
            {[1, 10, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setQuantidade(String((Number(quantidade) || 0) + n))}
                className="flex-1 py-3 rounded-xl bg-white border border-gray-200 font-semibold text-gray-800 active:bg-gray-100"
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
            className="w-full p-3 border rounded-xl bg-white"
          />
        </section>

        {/* 3. Motivo (um toque registra) */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            3. Motivo — toque para registrar
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {MOTIVOS.map((m) => (
              <button
                key={m.id}
                disabled={!podeRegistrar}
                onClick={() => registrar(m.id)}
                className={`h-20 rounded-2xl text-white font-bold text-base shadow-sm disabled:opacity-40 ${m.cor}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {confirmado && (
            <p className="flex items-center justify-center gap-1 text-green-600 font-medium text-sm">
              <Check size={16} /> Perda registrada
            </p>
          )}
        </section>

        {/* Resumo do mês */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Perdas do mês</h2>
          {resumo.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma perda registrada neste mês.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {resumo.map((r) => (
                <div key={r.motivo} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{rotulo(r.motivo)}</p>
                  <p className="font-bold text-gray-900">{r.ocorrencias} registro(s)</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Histórico recente */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Últimos registros</h2>
          {perdas.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3 flex justify-between text-sm">
              <div>
                <p className="font-semibold text-gray-900">{p.insumo.nome}</p>
                <p className="text-xs text-gray-500">
                  {rotulo(p.motivo)} • {new Date(p.criadoEm).toLocaleString('pt-BR')}
                </p>
              </div>
              <p className="font-bold text-red-600">
                -{p.quantidade} {p.insumo.unidade}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
