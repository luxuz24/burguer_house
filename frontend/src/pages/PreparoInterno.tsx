import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, ChefHat } from 'lucide-react';
import { api } from '../lib/api';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  fatorPerda: number;
  estoqueAtual: number;
  validadeDias?: number | null;
}

interface SubFichaItem {
  id: string;
  insumoBrutoId: string;
  quantidadeNecessaria: number;
  insumoBruto: Insumo;
}

interface Props {
  insumoId: string;
  onVoltar: () => void;
}

export default function PreparoInterno({ insumoId, onVoltar }: Props) {
  const [beneficiado, setBeneficiado] = useState<Insumo | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [itens, setItens] = useState<SubFichaItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [brutoId, setBrutoId] = useState('');
  const [qtdNecessaria, setQtdNecessaria] = useState('');
  const [qtdProduzir, setQtdProduzir] = useState('');
  const [produzindo, setProduzindo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [todos, sub] = await Promise.all([
        api.get('/insumos'),
        api.get(`/preparo-interno/sub-fichas/${insumoId}`),
      ]);
      const lista: Insumo[] = todos.data;
      setInsumos(lista);
      setBeneficiado(lista.find((i) => i.id === insumoId) ?? null);
      setItens(sub.data);
    } catch {
      alert('Erro ao carregar dados do preparo.');
    } finally {
      setCarregando(false);
    }
  }, [insumoId]);

  useEffect(() => {
    const timer = setTimeout(carregar, 0);
    return () => clearTimeout(timer);
  }, [carregar]);

  const vincular = async () => {
    try {
      await api.post('/preparo-interno/sub-fichas', {
        insumoBeneficiadoId: insumoId,
        insumoBrutoId: brutoId,
        quantidadeNecessaria: Number(qtdNecessaria),
      });
      setBrutoId('');
      setQtdNecessaria('');
      carregar();
    } catch {
      alert('Erro ao adicionar ingrediente (já vinculado?).');
    }
  };

  const remover = async (id: string) => {
    if (!confirm('Remover ingrediente da sub-ficha?')) return;
    try {
      await api.delete(`/preparo-interno/sub-fichas/${id}`);
      carregar();
    } catch {
      alert('Erro ao remover ingrediente.');
    }
  };

  const qtd = Number(qtdProduzir);
  const previa = itens.map((it) => {
    const consumo = it.quantidadeNecessaria * (1 + it.insumoBruto.fatorPerda) * (qtd || 0);
    return { ...it, consumo, suficiente: it.insumoBruto.estoqueAtual >= consumo };
  });
  const podeProduzir = qtd > 0 && itens.length > 0 && previa.every((p) => p.suficiente) && !produzindo;

  const produzir = async () => {
    setProduzindo(true);
    try {
      await api.post('/preparo-interno/produzir', { insumoBeneficiadoId: insumoId, quantidade: qtd });
      setQtdProduzir('');
      await carregar();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      alert(msg ?? 'Erro ao produzir.');
    } finally {
      setProduzindo(false);
    }
  };

  if (carregando || !beneficiado) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Carregando...</p>
      </div>
    );
  }

  const disponiveis = insumos.filter((i) => i.id !== insumoId && !itens.some((it) => it.insumoBrutoId === i.id));

  return (
    <div className="flex flex-col min-h-full pb-20 bg-gray-50">
      <div className="bg-white p-4 border-b border-gray-200 flex items-center gap-3">
        <button onClick={onVoltar} className="text-gray-600 p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{beneficiado.nome}</h1>
          <p className="text-xs text-gray-500">
            Estoque: {beneficiado.estoqueAtual} {beneficiado.unidade}
            {beneficiado.validadeDias ? ` • Validade: ${beneficiado.validadeDias} dias` : ''}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Produzir */}
        <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <ChefHat size={18} /> Produzir
          </h2>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={`Quantidade a produzir (${beneficiado.unidade})`}
            value={qtdProduzir}
            onChange={(e) => setQtdProduzir(e.target.value)}
            className="w-full p-3 border rounded-xl bg-gray-50"
          />
          {qtd > 0 &&
            previa.map((p) => (
              <p key={p.id} className={`text-sm ${p.suficiente ? 'text-gray-600' : 'text-red-600 font-medium'}`}>
                {p.insumoBruto.nome}: {p.consumo.toFixed(2)} {p.insumoBruto.unidade}
                {!p.suficiente && ` (estoque: ${p.insumoBruto.estoqueAtual})`}
              </p>
            ))}
          <button
            onClick={produzir}
            disabled={!podeProduzir}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-40"
          >
            {produzindo ? 'Produzindo...' : `Produzir ${qtd > 0 ? qtd : ''} ${beneficiado.unidade}`}
          </button>
          {itens.length === 0 && <p className="text-xs text-gray-400">Cadastre a sub-ficha abaixo para poder produzir.</p>}
        </section>

        {/* Sub-ficha */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Sub-ficha (por 1 {beneficiado.unidade})
          </h2>
          {itens.map((it) => (
            <div key={it.id} className="bg-white rounded-xl border border-gray-200 p-3 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{it.insumoBruto.nome}</p>
                <p className="text-xs text-gray-500">
                  {it.quantidadeNecessaria} {it.insumoBruto.unidade}
                </p>
              </div>
              <button onClick={() => remover(it.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <select
              value={brutoId}
              onChange={(e) => setBrutoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            >
              <option value="">Selecione o insumo bruto...</option>
              {disponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} ({i.unidade})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.001"
              placeholder={`Quantidade por 1 ${beneficiado.unidade}`}
              value={qtdNecessaria}
              onChange={(e) => setQtdNecessaria(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            />
            <button
              onClick={vincular}
              disabled={!brutoId || !(Number(qtdNecessaria) > 0)}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={18} /> Adicionar ingrediente
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
