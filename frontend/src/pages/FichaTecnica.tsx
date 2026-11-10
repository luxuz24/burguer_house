import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Trash,
  PencilSimple,
  CircleNotch,
  Check,
  X,
  WarningCircle,
  ArrowsClockwise,
} from '../components/ui/icons';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import { formatarQuantidade, descontoComPerda } from '../lib/formatar';
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
  onSelecionarProduto?: (id: string) => void;
}

export default function FichaTecnica({ produtoId, onVoltar, onSelecionarProduto }: FichaTecnicaProps) {
  const [produto, setProduto] = useState<Produto | null>(null);
  const [insumosDisponiveis, setInsumosDisponiveis] = useState<Insumo[]>([]);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [, setAtualizando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState<{
    tipo: 'nao_encontrado' | 'erro';
    mensagem: string;
  } | null>(null);
  const [erroInsumos, setErroInsumos] = useState<string | null>(null);
  const [produtoConflito, setProdutoConflito] = useState<{ id: string; nome: string } | null>(null);

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

  const carregarInsumos = useCallback(async () => {
    try {
      const resInsumos = await api.get('/insumos');
      setInsumosDisponiveis(resInsumos.data);
      setErroInsumos(null);
    } catch (error) {
      setErroInsumos(mensagemDeErro(error, 'Não foi possível carregar a lista de insumos.'));
    }
  }, []);

  const recarregarDados = useCallback(async () => {
    setAtualizando(true);
    try {
      const [resProduto, resInsumos] = await Promise.allSettled([
        api.get(`/produtos/${produtoId}`),
        api.get('/insumos'),
      ]);

      if (resProduto.status === 'fulfilled') {
        setProduto(resProduto.value.data);
        setErroCarregamento(null);
      } else {
        const error = resProduto.reason as { response?: { status?: number } };
        const status = error?.response?.status;
        if (status === 404) {
          setErroCarregamento({
            tipo: 'nao_encontrado',
            mensagem: 'Produto não encontrado.',
          });
        }
      }

      if (resInsumos.status === 'fulfilled') {
        setInsumosDisponiveis(resInsumos.value.data);
        setErroInsumos(null);
      }
    } finally {
      setAtualizando(false);
    }
  }, [produtoId]);

  const carregarDadosInicial = useCallback(async () => {
    setCarregandoInicial(true);
    setErroCarregamento(null);

    try {
      const resProduto = await api.get(`/produtos/${produtoId}`);
      setProduto(resProduto.data);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setErroCarregamento({
          tipo: 'nao_encontrado',
          mensagem: 'Produto não encontrado.',
        });
      } else {
        setErroCarregamento({
          tipo: 'erro',
          mensagem: mensagemDeErro(error, 'Erro ao carregar dados da ficha técnica.'),
        });
      }
      toast.erro(mensagemDeErro(error, 'Erro ao carregar dados da ficha técnica.'));
    }

    try {
      const resInsumos = await api.get('/insumos');
      setInsumosDisponiveis(resInsumos.data);
      setErroInsumos(null);
    } catch (error: unknown) {
      setErroInsumos(mensagemDeErro(error, 'Não foi possível carregar a lista de insumos.'));
    } finally {
      setCarregandoInicial(false);
    }
  }, [produtoId, toast]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregandoInicial(true);
      setErroCarregamento(null);

      try {
        const resProduto = await api.get(`/produtos/${produtoId}`);
        if (!ativo) return;
        setProduto(resProduto.data);
      } catch (error: unknown) {
        if (!ativo) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setErroCarregamento({
            tipo: 'nao_encontrado',
            mensagem: 'Produto não encontrado.',
          });
        } else {
          setErroCarregamento({
            tipo: 'erro',
            mensagem: mensagemDeErro(error, 'Erro ao carregar dados da ficha técnica.'),
          });
        }
        toast.erro(mensagemDeErro(error, 'Erro ao carregar dados da ficha técnica.'));
      }

      try {
        const resInsumos = await api.get('/insumos');
        if (!ativo) return;
        setInsumosDisponiveis(resInsumos.data);
        setErroInsumos(null);
      } catch (error: unknown) {
        if (!ativo) return;
        setErroInsumos(mensagemDeErro(error, 'Não foi possível carregar a lista de insumos.'));
      } finally {
        if (ativo) {
          setCarregandoInicial(false);
        }
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [produtoId, toast]);

  // Ações mutativas protegidas por useEnvio contra clique duplo e corrida (A2)
  const { enviando: adicionandoInsumo, executar: executarAdicionarInsumo } = useEnvio(async () => {
    if (!produto) return;
    if (!insumoSelecionadoId) {
      toast.aviso('Selecione um insumo para vincular.');
      return;
    }
    const qtdTexto = quantidadeDesejada.replace(',', '.').trim();
    if (!qtdTexto) {
      toast.aviso('Informe a quantidade utilizada.');
      return;
    }
    const qtd = Number(qtdTexto);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.aviso('A quantidade deve ser maior que zero.');
      return;
    }

    try {
      await api.post('/fichas-tecnicas', {
        produtoId: produto.id,
        insumoId: insumoSelecionadoId,
        quantidade: qtd,
      });

      setMostrandoForm(false);
      setInsumoSelecionadoId('');
      setQuantidadeDesejada('');
      await recarregarDados();
      toast.sucesso('Ingrediente vinculado à receita.');
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.erro(mensagemDeErro(error, 'Insumo não encontrado. Ele pode ter sido removido em outra sessão.'));
        setInsumoSelecionadoId('');
        await carregarInsumos();
        return;
      }
      if (status === 409) {
        toast.erro(mensagemDeErro(error, 'Este ingrediente já faz parte da ficha técnica.'));
        setMostrandoForm(false);
        setInsumoSelecionadoId('');
        setQuantidadeDesejada('');
        await recarregarDados();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao adicionar ingrediente à ficha técnica.'));
    }
  });

  const { enviando: salvandoEdicao, executar: executarSalvarEdicao } = useEnvio(async (fichaId: string) => {
    const qtdTexto = quantidadeEditando.replace(',', '.').trim();
    if (!qtdTexto) {
      toast.aviso('Informe a quantidade do ingrediente.');
      return;
    }
    const qtd = Number(qtdTexto);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.aviso('Informe uma quantidade maior que zero.');
      return;
    }

    try {
      await api.put(`/fichas-tecnicas/${fichaId}`, { quantidade: qtd });
      setFichaEditandoId(null);
      setQuantidadeEditando('');
      await recarregarDados();
      toast.sucesso('Quantidade atualizada na receita.');
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.erro(mensagemDeErro(error, 'Item da ficha não encontrado. Ele pode ter sido removido.'));
        setFichaEditandoId(null);
        setQuantidadeEditando('');
        await recarregarDados();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao atualizar quantidade do ingrediente.'));
    }
  });

  const { enviando: salvandoNomeProduto, executar: executarSalvarNomeProduto } = useEnvio(async () => {
    const nomeLimpo = novoNomeProduto.trim();
    if (!produto) return;
    if (!nomeLimpo) {
      toast.erro('O nome do produto é obrigatório.');
      return;
    }

    try {
      await api.put(`/produtos/${produto.id}`, { nome: nomeLimpo });
      setEditandoNomeProduto(false);
      setProdutoConflito(null);
      await recarregarDados();
      toast.sucesso('Nome do produto atualizado.');
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string; produtoConflito?: { id: string; nome: string } } } };
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 400) {
        // 400: mantém o campo aberto com o texto digitado
        toast.erro(mensagemDeErro(error, 'Nome de produto inválido.'));
        return;
      }
      if (status === 404) {
        setErroCarregamento({
          tipo: 'nao_encontrado',
          mensagem: 'Produto não encontrado. Ele pode ter sido removido em outra sessão.',
        });
        toast.erro('Produto não encontrado.');
        return;
      }
      if (status === 409) {
        if (data?.produtoConflito) {
          setProdutoConflito(data.produtoConflito);
        }
        toast.erro(data?.message || 'Já existe um produto cadastrado com este nome.');
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao renomear produto.'));
    }
  });

  const { enviando: excluindoProduto, executar: executarExcluirProduto } = useEnvio(async () => {
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
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.info('Este produto já havia sido excluído.');
        onVoltar();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao excluir produto.'));
    }
  });

  const { enviando: removendoInsumo, executar: executarRemoverInsumo } = useEnvio(async (fichaId: string, nomeInsumo?: string) => {
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
      await recarregarDados();
      toast.sucesso('Ingrediente removido da ficha técnica.');
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.info('Este ingrediente já havia sido removido.');
        await recarregarDados();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao remover ingrediente.'));
    }
  });

  if (carregandoInicial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500 dark:text-gray-400">
        <CircleNotch className="animate-spin mb-2" size={32} />
        <p>Carregando Ficha Técnica...</p>
      </div>
    );
  }

  if (erroCarregamento || !produto) {
    const ehNaoEncontrado = erroCarregamento?.tipo === 'nao_encontrado' || (!erroCarregamento && !produto);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full mb-3">
          <WarningCircle size={32} weight="bold" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          {ehNaoEncontrado ? 'Produto não encontrado' : 'Erro ao carregar dados'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          {ehNaoEncontrado
            ? 'Este produto pode ter sido excluído ou não existe no catálogo.'
            : erroCarregamento?.mensagem || 'Não foi possível carregar as informações deste produto.'}
        </p>
        <div className="flex gap-2">
          {!ehNaoEncontrado && (
            <button
              type="button"
              onClick={carregarDadosInicial}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <ArrowsClockwise size={16} />
              Tentar novamente
            </button>
          )}
          <button
            type="button"
            onClick={onVoltar}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
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
            className="text-gray-600 dark:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Voltar"
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
                  aria-label="Editar nome do produto"
                />
                <button
                  type="button"
                  onClick={() => executarSalvarNomeProduto()}
                  disabled={salvandoNomeProduto}
                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                  title="Salvar nome"
                  aria-label="Salvar nome do produto"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoNomeProduto(false);
                    setProdutoConflito(null);
                  }}
                  className="p-1.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Cancelar"
                  aria-label="Cancelar edição de nome"
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
                    setProdutoConflito(null);
                  }}
                  className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 p-1 rounded-lg cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Renomear produto"
                  aria-label="Renomear produto"
                >
                  <PencilSimple size={15} />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Hambúrgueres Artesanais • <span className="text-blue-500 dark:text-blue-400">Cód: {produto.id ? produto.id.substring(0, 8).toUpperCase() : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-400 text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-green-200 dark:border-green-800/60">
              <CheckCircle size={14} /> Ativo
            </span>
            <button
              type="button"
              onClick={() => executarExcluirProduto()}
              disabled={excluindoProduto}
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
              title="Excluir produto"
              aria-label={`Excluir produto ${produto.nome}`}
            >
              <Trash size={18} />
            </button>
          </div>
        </div>

        {/* Alerta de conflito 409 ao renomear */}
        {produtoConflito && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <span>
              Já existe: <strong>{produtoConflito.nome}</strong>
            </span>
            {onSelecionarProduto && (
              <button
                type="button"
                onClick={() => {
                  setProdutoConflito(null);
                  onSelecionarProduto(produtoConflito.id);
                }}
                className="font-bold underline cursor-pointer ml-2 hover:opacity-80"
              >
                Abrir produto existente
              </button>
            )}
          </div>
        )}

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
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm cursor-pointer min-h-[44px]"
          >
            <Plus size={20} weight="bold" />
            Adicionar Insumo
          </button>
        ) : (
          <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 mt-2 space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Vincular novo Insumo</h3>

            {erroInsumos && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
                <span>{erroInsumos}</span>
                <button
                  type="button"
                  onClick={carregarInsumos}
                  className="font-semibold underline ml-2 cursor-pointer flex items-center gap-1"
                >
                  <ArrowsClockwise size={14} /> Tentar novamente
                </button>
              </div>
            )}

            <select
              value={insumoSelecionadoId}
              onChange={(e) => setInsumoSelecionadoId(e.target.value)}
              aria-label="Selecionar insumo"
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
            >
              <option value="">Selecione o insumo...</option>
              {insumosDisponiveis
                .filter((insumo) => !produto.fichasTecnicas?.some((ft) => ft.insumoId === insumo.id))
                .map((insumo) => (
                  <option key={insumo.id} value={insumo.id}>
                    {insumo.nome} ({insumo.unidade})
                  </option>
                ))}
            </select>

            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.0001"
              placeholder="Quantidade utilizada (bruta)"
              aria-label="Quantidade utilizada"
              value={quantidadeDesejada}
              onChange={(e) => setQuantidadeDesejada(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMostrandoForm(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-medium cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executarAdicionarInsumo()}
                disabled={adicionandoInsumo}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
              >
                {adicionandoInsumo ? 'Salvando...' : 'Confirmar'}
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
            const fatorPerdaNormalizado = Math.max(0, Number(ficha.insumo.fatorPerda) || 0);

            return (
              <div
                key={ficha.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm relative transition-colors"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{ficha.insumo.nome}</h3>
                    {editandoEsta ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.0001"
                          autoFocus
                          value={quantidadeEditando}
                          onChange={(e) => setQuantidadeEditando(e.target.value)}
                          className="w-28 p-1.5 text-sm rounded-lg border border-blue-400 dark:border-blue-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
                          aria-label={`Editar quantidade de ${ficha.insumo.nome}`}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">{ficha.insumo.unidade}</span>
                        <button
                          type="button"
                          onClick={() => executarSalvarEdicao(ficha.id)}
                          disabled={salvandoEdicao}
                          className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                          title="Salvar quantidade"
                          aria-label={`Salvar quantidade de ${ficha.insumo.nome}`}
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFichaEditandoId(null);
                            setQuantidadeEditando('');
                          }}
                          className="p-1.5 bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Cancelar"
                          aria-label="Cancelar edição de quantidade"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                          {formatarQuantidade(ficha.quantidade, ficha.insumo.unidade)}
                        </span>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Perda: {Number((fatorPerdaNormalizado * 100).toFixed(1))}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 -mt-1 -mr-1 shrink-0">
                    {!editandoEsta && (
                      <button
                        type="button"
                        onClick={() => {
                          setFichaEditandoId(ficha.id);
                          setQuantidadeEditando(String(ficha.quantidade));
                        }}
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label={`Editar quantidade de ${ficha.insumo.nome}`}
                        title="Editar quantidade"
                      >
                        <PencilSimple size={17} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => executarRemoverInsumo(ficha.id, ficha.insumo.nome)}
                      disabled={removendoInsumo}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                      aria-label={`Remover ${ficha.insumo.nome}`}
                      title="Remover ingrediente"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Desconto com perda: {formatarQuantidade(descontoComPerda(ficha.quantidade, ficha.insumo.fatorPerda), ficha.insumo.unidade)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
