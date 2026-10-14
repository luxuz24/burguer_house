import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CheckCircle2, Plus, Trash2, Loader2 } from 'lucide-react';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import EstadoVazio from '../components/EstadoVazio';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  fatorPerda: number;
}

interface FichaItem {
  id: string;
  insumoId: string;
  quantidade: number;
  insumo: Insumo;
}

interface Produto {
  id: string;
  nome: string;
  fichasTecnicas: FichaItem[];
}

interface FichaTecnicaProps {
  produtoId: string;
  onVoltar: () => void;
}

export default function FichaTecnica({ produtoId, onVoltar }: FichaTecnicaProps) {
  const [produto, setProduto] = useState<Produto | null>(null);

  const [insumosDisponiveis, setInsumosDisponiveis] = useState<Insumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados para o formulário de adicionar novo insumo
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [insumoSelecionadoId, setInsumoSelecionadoId] = useState('');
  const [quantidadeDesejada, setQuantidadeDesejada] = useState('');

  const { toast, confirmar } = useFeedback();

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      // Carregar o produto com suas fichas técnicas detalhadas
      const resProdutoDetalhado = await api.get(`/produtos/${produtoId}`);
      setProduto(resProdutoDetalhado.data);

      // Carregar todos os insumos para o select
      const resInsumos = await api.get('/insumos');
      setInsumosDisponiveis(resInsumos.data);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao carregar dados da ficha técnica.'));
    } finally {
      setCarregando(false);
    }
  }, [produtoId, toast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarDados]);

  const adicionarInsumo = async () => {
    if (!produto || !insumoSelecionadoId || !quantidadeDesejada) return;

    try {
      await api.post('/fichas-tecnicas', {
        produtoId: produto.id,
        insumoId: insumoSelecionadoId,
        quantidade: Number(quantidadeDesejada)
      });
      
      setMostrandoForm(false);
      setInsumoSelecionadoId('');
      setQuantidadeDesejada('');
      carregarDados();
      toast.sucesso('Ingrediente adicionado à receita.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao adicionar ingrediente à ficha técnica.'));
    }
  };

  const removerInsumo = async (fichaId: string, nomeInsumo?: string) => {
    const ok = await confirmar({
      titulo: 'Remover da receita',
      mensagem: nomeInsumo
        ? `Deseja remover "${nomeInsumo}" da ficha técnica de "${produto?.nome}"?`
        : 'Deseja remover este ingrediente da ficha técnica?',
      textoConfirmar: 'Remover',
      perigoso: true,
    });
    if (!ok) return;
    
    try {
      await api.delete(`/fichas-tecnicas/${fichaId}`);
      carregarDados();
      toast.sucesso('Ingrediente removido da ficha técnica.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao remover ingrediente.'));
    }
  };

  if (carregando || !produto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full h-[80vh] text-gray-500">
        <Loader2 className="animate-spin mb-2" size={32} />
        <p>Carregando Ficha Técnica...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 flex flex-col min-h-full pb-20">
      {/* Header Ficha Tecnica */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onVoltar} className="text-gray-600 p-1 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Ficha Técnica: {produto.nome}
            </h1>
            <p className="text-xs text-gray-500">
              Hambúrgueres Artesanais • <span className="text-blue-500">Cód: {produto.id.substring(0,8).toUpperCase()}</span>
            </p>
          </div>
          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-green-200">
            <CheckCircle2 size={14} /> Ativo
          </span>
        </div>

        {/* Info Block */}
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center">🍔</div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Estrutura de Montagem</p>
              <p className="text-xs text-gray-500">{produto.fichasTecnicas?.length || 0} insumos na ficha</p>
            </div>
          </div>
        </div>

        {!mostrandoForm ? (
          <button 
            onClick={() => setMostrandoForm(true)}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            <Plus size={20} strokeWidth={2.5} />
            Adicionar Insumo
          </button>
        ) : (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mt-2 space-y-3">
            <h3 className="font-semibold text-gray-700 text-sm">Vincular novo Insumo</h3>
            <select 
              value={insumoSelecionadoId} 
              onChange={e => setInsumoSelecionadoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            >
              <option value="">Selecione o insumo...</option>
              {insumosDisponiveis.map(insumo => (
                <option key={insumo.id} value={insumo.id}>{insumo.nome} ({insumo.unidade})</option>
              ))}
            </select>
            
            <input 
              type="number" 
              placeholder="Quantidade utilizada (bruta)"
              value={quantidadeDesejada}
              onChange={e => setQuantidadeDesejada(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            />
            
            <div className="flex gap-2">
              <button 
                onClick={() => setMostrandoForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={adicionarInsumo}
                disabled={!insumoSelecionadoId || !quantidadeDesejada}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Ingredientes */}
      <div className="p-4 flex-1">
        <h2 className="text-xs font-semibold text-gray-500 tracking-wider mb-3 px-1 uppercase">
          Ingredientes da Receita
        </h2>

        {(!produto.fichasTecnicas || produto.fichasTecnicas.length === 0) && !mostrandoForm && (
          <EstadoVazio
            icone={Plus}
            titulo="Nenhum ingrediente na receita"
            descricao={`Adicione os insumos que compõem o "${produto.nome}" para o sistema saber o desconto exato do estoque em cada venda.`}
            acao={{ texto: 'Adicionar primeiro ingrediente', onClick: () => setMostrandoForm(true) }}
          />
        )}

        <div className="flex flex-col gap-3">
          {produto.fichasTecnicas?.map((ficha) => (
            <div key={ficha.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm relative transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{ficha.insumo.nome}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                      {ficha.quantidade} {ficha.insumo.unidade}
                    </span>
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                      Perda: {ficha.insumo.fatorPerda * 100}%
                    </span>
                  </div>
                </div>
                
                <button 
                  type="button"
                  onClick={() => removerInsumo(ficha.id, ficha.insumo.nome)}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg transition-colors -mt-1 -mr-1 cursor-pointer"
                  aria-label={`Remover ${ficha.insumo.nome}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>Desconto com perda: {(ficha.quantidade * (1 + ficha.insumo.fatorPerda)).toFixed(2)} {ficha.insumo.unidade}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
