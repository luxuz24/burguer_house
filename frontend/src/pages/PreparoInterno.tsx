import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, Trash2, Edit2, ChefHat, Check, X } from 'lucide-react';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';

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

  const [editandoBrutoId, setEditandoBrutoId] = useState<string | null>(null);
  const [qtdEditando, setQtdEditando] = useState('');

  const { toast, confirmar } = useFeedback();

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
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao carregar dados do preparo.'));
    } finally {
      setCarregando(false);
    }
  }, [insumoId, toast]);

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
      toast.sucesso('Ingrediente adicionado à sub-ficha.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao adicionar ingrediente (já vinculado?).'));
    }
  };

  const salvarEdicaoSubFicha = async (insumoBrutoId: string) => {
    const qtd = Number(qtdEditando);
    if (!(qtd > 0)) {
      toast.aviso('Informe uma quantidade maior que zero.');
      return;
    }
    try {
      await api.post('/preparo-interno/sub-fichas', {
        insumoBeneficiadoId: insumoId,
        insumoBrutoId,
        quantidadeNecessaria: qtd,
      });
      setEditandoBrutoId(null);
      setQtdEditando('');
      carregar();
      toast.sucesso('Quantidade atualizada na sub-ficha.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao atualizar ingrediente da sub-ficha.'));
    }
  };

  const remover = async (id: string, nomeBruto?: string) => {
    const ok = await confirmar({
      titulo: 'Remover ingrediente',
      mensagem: nomeBruto
        ? `Remover "${nomeBruto}" da receita deste item beneficiado?`
        : 'Remover ingrediente da sub-ficha?',
      textoConfirmar: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/preparo-interno/sub-fichas/${id}`);
      carregar();
      toast.sucesso('Ingrediente removido da sub-ficha.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao remover ingrediente.'));
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
      toast.sucesso(`Produzido com sucesso: ${qtd} ${beneficiado?.unidade || ''} de "${beneficiado?.nome}".`);
    } catch (e) {
      toast.erro(mensagemDeErro(e, 'Erro ao produzir.'));
    } finally {
      setProduzindo(false);
    }
  };

  if (carregando || !beneficiado) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-gray-500 dark:text-gray-400">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Carregando...</p>
      </div>
    );
  }

  const disponiveis = insumos.filter((i) => i.id !== insumoId && !itens.some((it) => it.insumoBrutoId === i.id));

  return (
    <div className="flex flex-col min-h-full pb-20 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3 transition-colors">
        <button
          type="button"
          onClick={onVoltar}
          className="text-gray-600 dark:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{beneficiado.nome}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Estoque: {beneficiado.estoqueAtual} {beneficiado.unidade}
            {beneficiado.validadeDias ? ` • Validade: ${beneficiado.validadeDias} dias` : ''}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Produzir */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 transition-colors">
          <h2 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <ChefHat size={18} className="text-purple-600 dark:text-purple-400" /> Produzir
          </h2>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={`Quantidade a produzir (${beneficiado.unidade})`}
            value={qtdProduzir}
            onChange={(e) => setQtdProduzir(e.target.value)}
            className="w-full p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {qtd > 0 &&
            previa.map((p) => (
              <p key={p.id} className={`text-sm ${p.suficiente ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400 font-medium'}`}>
                {p.insumoBruto.nome}: {p.consumo.toFixed(2)} {p.insumoBruto.unidade}
                {!p.suficiente && ` (estoque: ${p.insumoBruto.estoqueAtual})`}
              </p>
            ))}
          <button
            type="button"
            onClick={produzir}
            disabled={!podeProduzir}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold disabled:opacity-40 cursor-pointer transition-colors"
          >
            {produzindo ? 'Produzindo...' : `Produzir ${qtd > 0 ? qtd : ''} ${beneficiado.unidade}`}
          </button>
          {itens.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500">Cadastre a sub-ficha abaixo para poder produzir.</p>}
        </section>

        {/* Sub-ficha */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Sub-ficha (por 1 {beneficiado.unidade})
          </h2>
          {itens.map((it) => {
            const editandoEste = editandoBrutoId === it.insumoBrutoId;

            return (
              <div key={it.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex justify-between items-center transition-colors">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{it.insumoBruto.nome}</p>
                  {editandoEste ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        autoFocus
                        value={qtdEditando}
                        onChange={(e) => setQtdEditando(e.target.value)}
                        className="w-28 p-1.5 text-sm rounded-lg border border-blue-400 dark:border-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{it.insumoBruto.unidade}</span>
                      <button
                        type="button"
                        onClick={() => salvarEdicaoSubFicha(it.insumoBrutoId)}
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                        title="Salvar quantidade"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoBrutoId(null);
                          setQtdEditando('');
                        }}
                        className="p-1.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {it.quantidadeNecessaria} {it.insumoBruto.unidade}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!editandoEste && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoBrutoId(it.insumoBrutoId);
                        setQtdEditando(String(it.quantidadeNecessaria));
                      }}
                      className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 p-2 rounded-lg cursor-pointer"
                      aria-label={`Editar ${it.insumoBruto.nome}`}
                      title="Editar quantidade"
                    >
                      <Edit2 size={17} />
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => remover(it.id, it.insumoBruto.nome)} 
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg cursor-pointer"
                    aria-label={`Remover ${it.insumoBruto.nome}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-2 transition-colors">
            <select
              value={brutoId}
              onChange={(e) => setBrutoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={vincular}
              disabled={!brutoId || !(Number(qtdNecessaria) > 0)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <Plus size={18} /> Adicionar ingrediente
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
