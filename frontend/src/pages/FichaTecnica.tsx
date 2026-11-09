import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CheckCircle, Plus, Trash, PencilSimple, CircleNotch, Check, X } from '../components/ui/icons';
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

  // Estados para edição de item da ficha e edição do nome do produto
  const [fichaEditandoId, setFichaEditandoId] = useState<string | null>(null);
  const [quantidadeEditando, setQuantidadeEditando] = useState('');
  const [editandoNomeProduto, setEditandoNomeProduto] = useState(false);
  const [novoNomeProduto, setNovoNomeProduto] = useState('');

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
    const qtd = Number(quantidadeDesejada);
    if (!produto || !insumoSelecionadoId || !(qtd > 0)) return;

    try {
      await api.post('/fichas-tecnicas', {
        produtoId: produto.id,
        insumoId: insumoSelecionadoId,
        quantidade: qtd,
      });
      
      setMostrandoForm(false);
      setInsumoSelecionadoId('');
      setQuantidadeDesejada('');
      carregarDados();
      toast.sucesso('Ingrediente vinculado à receita.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao adicionar ingrediente à ficha técnica.'));
    }
  };

  const salvarEdicaoFicha = async (fichaId: string) => {
    const qtd = Number(quantidadeEditando);
    if (!(qtd > 0)) {
      toast.aviso('Informe uma quantidade maior que zero.');
      return;
    }

    try {
      await api.put(`/fichas-tecnicas/${fichaId}`, { quantidade: qtd });
      setFichaEditandoId(null);
      setQuantidadeEditando('');
      carregarDados();
      toast.sucesso('Quantidade atualizada na receita.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao atualizar quantidade do ingrediente.'));
    }
  };

  const salvarNomeProduto = async () => {
    const nomeLimpo = novoNomeProduto.trim();
    if (!produto || !nomeLimpo) return;

    try {
      await api.put(`/produtos/${produto.id}`, { nome: nomeLimpo });
      setEditandoNomeProduto(false);
      carregarDados();
      toast.sucesso('Nome do produto atualizado.');
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao renomear produto.'));
    }
  };

  const excluirProdutoAtual = async () => {
    if (!produto) return;
    const ok = await confirmar({
      titulo: 'Excluir produto',
      mensagem: `Deseja realmente excluir o produto "${produto.nome}" e toda a sua ficha técnica?`,
      textoConfirmar: 'Excluir produto',
      perigoso: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/produtos/${produto.id}`);
      toast.sucesso(`Produto "${produto.nome}" removido.`);
      onVoltar();
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao excluir produto.'));
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
      <div className="flex flex-col items-center justify-center min-h-full h-[80vh] text-gray-500 dark:text-gray-400">
        <CircleNotch className="animate-spin mb-2" size={32} />
        <p>Carregando Ficha Técnica...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col min-h-full pb-20 transition-colors">
      {/* Header Ficha Tecnica */}
      <div className="bg-white dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onVoltar}
            className="text-gray-600 dark:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 min-w-0">
            {editandoNomeProduto ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={novoNomeProduto}
                  onChange={(e) => setNovoNomeProduto(e.target.value)}
                  className="flex-1 min-w-0 p-1.5 text-sm font-bold rounded-lg border border-blue-400 dark:border-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={salvarNomeProduto}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                  title="Salvar nome"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoNomeProduto(false)}
                  className="p-1.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer"
                  title="Cancelar"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                  Ficha Técnica: {produto.nome}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setNovoNomeProduto(produto.nome);
                    setEditandoNomeProduto(true);
                  }}
                  className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-1 rounded-lg cursor-pointer shrink-0"
                  title="Renomear produto"
                >
                  <PencilSimple size={15} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hambúrgueres Artesanais • <span className="text-blue-500 dark:text-blue-400">Cód: {produto.id.substring(0,8).toUpperCase()}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-green-200 dark:border-green-800/60">
              <CheckCircle size={14} /> Ativo
            </span>
            <button
              type="button"
              onClick={excluirProdutoAtual}
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Excluir produto"
              aria-label={`Excluir produto ${produto.nome}`}
            >
              <Trash size={18} />
            </button>
          </div>
        </div>

        {/* Info Block */}
        <div className="bg-blue-50/50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 p-2 rounded-lg">
              <div className="w-5 h-5 flex items-center justify-center">🍔</div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Estrutura de Montagem</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{produto.fichasTecnicas?.length || 0} insumos na ficha</p>
            </div>
          </div>
        </div>

        {!mostrandoForm ? (
          <button 
            type="button"
            onClick={() => setMostrandoForm(true)}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={20} weight="bold" />
            Adicionar Insumo
          </button>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mt-2 space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Vincular novo Insumo</h3>
            <select 
              value={insumoSelecionadoId} 
              onChange={e => setInsumoSelecionadoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">Selecione o insumo...</option>
              {insumosDisponiveis
                .filter(insumo => !produto.fichasTecnicas?.some(ft => ft.insumoId === insumo.id))
                .map(insumo => (
                  <option key={insumo.id} value={insumo.id}>{insumo.nome} ({insumo.unidade})</option>
                ))}
            </select>
            
            <input 
              type="number" 
              min="0"
              step="0.01"
              placeholder="Quantidade utilizada (bruta)"
              value={quantidadeDesejada}
              onChange={e => setQuantidadeDesejada(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
            
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setMostrandoForm(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={adicionarInsumo}
                disabled={!insumoSelecionadoId || !(Number(quantidadeDesejada) > 0)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Ingredientes */}
      <div className="p-4 flex-1">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider mb-3 px-1 uppercase">
          Ingredientes da Receita
        </h2>

        {(!produto.fichasTecnicas || produto.fichasTecnicas.length === 0) && !mostrandoForm && (
          <EstadoVazio
            titulo="Nenhum ingrediente na receita"
            descricao={`Adicione os insumos que compõem o "${produto.nome}" para o sistema saber o desconto exato do estoque em cada venda.`}
            acao={{ texto: 'Adicionar primeiro ingrediente', onClick: () => setMostrandoForm(true) }}
          />
        )}

        <div className="flex flex-col gap-3">
          {produto.fichasTecnicas?.map((ficha) => {
            const editandoEsta = fichaEditandoId === ficha.id;

            return (
              <div key={ficha.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm relative transition-colors">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{ficha.insumo.nome}</h3>
                    {editandoEsta ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus
                          value={quantidadeEditando}
                          onChange={(e) => setQuantidadeEditando(e.target.value)}
                          className="w-28 p-1.5 text-sm rounded-lg border border-blue-400 dark:border-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ficha.insumo.unidade}</span>
                        <button
                          type="button"
                          onClick={() => salvarEdicaoFicha(ficha.id)}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                          title="Salvar quantidade"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFichaEditandoId(null);
                            setQuantidadeEditando('');
                          }}
                          className="p-1.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer"
                          title="Cancelar"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          {ficha.quantidade} {ficha.insumo.unidade}
                        </span>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Perda: {Number((ficha.insumo.fatorPerda * 100).toFixed(1))}%
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 -mt-1 -mr-1">
                    {!editandoEsta && (
                      <button
                        type="button"
                        onClick={() => {
                          setFichaEditandoId(ficha.id);
                          setQuantidadeEditando(String(ficha.quantidade));
                        }}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 p-2 rounded-lg transition-colors cursor-pointer"
                        aria-label={`Editar quantidade de ${ficha.insumo.nome}`}
                        title="Editar quantidade"
                      >
                        <PencilSimple size={17} />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => removerInsumo(ficha.id, ficha.insumo.nome)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg transition-colors cursor-pointer"
                      aria-label={`Remover ${ficha.insumo.nome}`}
                      title="Remover ingrediente"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span>Desconto com perda: {(ficha.quantidade * (1 + ficha.insumo.fatorPerda)).toFixed(2)} {ficha.insumo.unidade}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
