import { useState } from 'react';
import { motion } from 'motion/react';
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
  Hamburger,
} from '../components/ui/icons';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import { useCarregamento } from '../hooks/useCarregamento';
import { stagger, rise, tap } from '../lib/motion';
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
  const produto = useCarregamento<Produto>(
    () => api.get(`/produtos/${produtoId}`).then((r) => r.data),
    [produtoId],
    { mensagemPadrao: 'Erro ao carregar dados da ficha técnica.' },
  );
  const insumos = useCarregamento<Insumo[]>(
    () => api.get('/insumos').then((r) => r.data),
    [],
    { mensagemPadrao: 'Não foi possível carregar a lista de insumos.' },
  );

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

  // Ações mutativas protegidas por useEnvio contra clique duplo e corrida (A2)
  const { enviando: adicionandoInsumo, executar: executarAdicionarInsumo } = useEnvio(async () => {
    if (!produto.dados) return;
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
        produtoId: produto.dados.id,
        insumoId: insumoSelecionadoId,
        quantidade: qtd,
      });

      setMostrandoForm(false);
      setInsumoSelecionadoId('');
      setQuantidadeDesejada('');
      const ok = await produto.recarregar();
      void insumos.recarregar();
      if (ok) {
        toast.sucesso('Ingrediente vinculado à receita.');
      } else {
        toast.aviso('Salvo, mas não foi possível atualizar a ficha.');
      }
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.erro(mensagemDeErro(error, 'Insumo não encontrado. Ele pode ter sido removido em outra sessão.'));
        setInsumoSelecionadoId('');
        void insumos.recarregar();
        return;
      }
      if (status === 409) {
        toast.erro(mensagemDeErro(error, 'Este ingrediente já faz parte da ficha técnica.'));
        setMostrandoForm(false);
        setInsumoSelecionadoId('');
        setQuantidadeDesejada('');
        void produto.recarregar();
        void insumos.recarregar();
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
      const ok = await produto.recarregar();
      void insumos.recarregar();
      if (ok) {
        toast.sucesso('Quantidade atualizada na receita.');
      } else {
        toast.aviso('Salvo, mas não foi possível atualizar a ficha.');
      }
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.erro(mensagemDeErro(error, 'Item da ficha não encontrado. Ele pode ter sido removido.'));
        setFichaEditandoId(null);
        setQuantidadeEditando('');
        void produto.recarregar();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao atualizar quantidade do ingrediente.'));
    }
  });

  const { enviando: salvandoNomeProduto, executar: executarSalvarNomeProduto } = useEnvio(async () => {
    const nomeLimpo = novoNomeProduto.trim();
    if (!produto.dados) return;
    if (!nomeLimpo) {
      toast.erro('O nome do produto é obrigatório.');
      return;
    }

    try {
      await api.put(`/produtos/${produto.dados.id}`, { nome: nomeLimpo });
      setEditandoNomeProduto(false);
      setProdutoConflito(null);
      const ok = await produto.recarregar();
      void insumos.recarregar();
      if (ok) {
        toast.sucesso('Nome do produto atualizado.');
      } else {
        toast.aviso('Salvo, mas não foi possível atualizar a ficha.');
      }
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
        toast.erro('Produto não encontrado.');
        void produto.recarregar();
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
    if (!produto.dados) return;
    const ok = await confirmar({
      titulo: 'Excluir produto',
      mensagem: `Deseja realmente excluir o produto "${produto.dados.nome}" e toda a sua ficha técnica?`,
      textoConfirmar: 'Excluir produto',
      perigoso: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/produtos/${produto.dados.id}`);
      toast.sucesso(`Produto "${produto.dados.nome}" removido.`);
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
        ? `Deseja remover "${nomeInsumo}" da ficha técnica de "${produto.dados?.nome}"?`
        : 'Deseja remover este ingrediente da ficha técnica?',
      textoConfirmar: 'Remover',
      perigoso: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/fichas-tecnicas/${fichaId}`);
      const ok = await produto.recarregar();
      void insumos.recarregar();
      if (ok) {
        toast.sucesso('Ingrediente removido da ficha técnica.');
      } else {
        toast.aviso('Salvo, mas não foi possível atualizar a ficha.');
      }
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        toast.info('Este ingrediente já havia sido removido.');
        void produto.recarregar();
        return;
      }
      toast.erro(mensagemDeErro(error, 'Erro ao remover ingrediente.'));
    }
  });

  if (produto.carregandoInicial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-muted">
        <CircleNotch className="animate-spin mb-2 text-primary" size={32} />
        <p className="text-sm font-medium">Carregando Ficha Técnica...</p>
      </div>
    );
  }

  if (produto.erro || !produto.dados) {
    const ehNaoEncontrado = produto.erro?.tipo === 'nao_encontrado' || (!produto.erro && !produto.dados);
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="p-3 bg-danger-soft text-danger rounded-full mb-3">
          <WarningCircle size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-1">
          {ehNaoEncontrado ? 'Produto não encontrado' : 'Erro ao carregar dados'}
        </h2>
        <p className="text-sm text-muted max-w-sm mb-4">
          {ehNaoEncontrado
            ? 'Este produto pode ter sido excluído ou não existe no catálogo.'
            : produto.erro?.mensagem || 'Não foi possível carregar as informações deste produto.'}
        </p>
        <div className="flex gap-2">
          {!ehNaoEncontrado && (
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => produto.tentarNovamente()}
              className="px-4 py-2 bg-primary hover:bg-primary-deep text-on-primary rounded-lg text-sm font-bold flex items-center gap-1.5 cursor-pointer min-h-[44px] shadow-sm"
            >
              <ArrowsClockwise size={16} weight="duotone" />
              Tentar novamente
            </motion.button>
          )}
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onVoltar}
            className="px-4 py-2 bg-field hover:bg-card-2 text-ink rounded-lg text-sm font-medium flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <ArrowLeft size={16} />
            Voltar
          </motion.button>
        </div>
      </div>
    );
  }

  const dadosProduto = produto.dados;

  return (
    <div className="bg-canvas text-ink flex flex-col min-h-full pb-20 transition-colors">
      {/* Header Ficha Tecnica */}
      <div className="bg-card p-4 border-b border-line transition-colors">
        <div className="flex items-center gap-3 mb-4">
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onVoltar}
            className="text-muted hover:text-ink p-1 hover:bg-field rounded-full cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={24} />
          </motion.button>
          <div className="flex-1 min-w-0">
            {editandoNomeProduto ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  value={novoNomeProduto}
                  onChange={(e) => setNovoNomeProduto(e.target.value)}
                  className="flex-1 min-w-0 p-1.5 text-sm font-bold rounded-lg border border-line bg-field text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
                  aria-label="Editar nome do produto"
                />
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={() => executarSalvarNomeProduto()}
                  disabled={salvandoNomeProduto}
                  className="p-1.5 bg-success hover:opacity-90 text-white rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 shadow-sm"
                  title="Salvar nome"
                  aria-label="Salvar nome do produto"
                >
                  <Check size={16} weight="bold" />
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={() => {
                    setEditandoNomeProduto(false);
                    setProdutoConflito(null);
                  }}
                  className="p-1.5 bg-field hover:bg-card-2 text-ink rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                  title="Cancelar"
                  aria-label="Cancelar edição de nome"
                >
                  <X size={16} />
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-lg font-bold text-ink leading-tight truncate">
                  Ficha Técnica: {dadosProduto.nome}
                </h1>
                <motion.button
                  type="button"
                  whileTap={tap}
                  onClick={() => {
                    setNovoNomeProduto(dadosProduto.nome);
                    setEditandoNomeProduto(true);
                    setProdutoConflito(null);
                  }}
                  className="text-muted hover:text-ink p-1 rounded-lg cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-field transition-colors"
                  title="Renomear produto"
                  aria-label="Renomear produto"
                >
                  <PencilSimple size={15} weight="duotone" />
                </motion.button>
              </div>
            )}
            <p className="text-xs text-muted">
              Hambúrgueres Artesanais • <span className="text-primary font-medium">Cód: {dadosProduto.id ? dadosProduto.id.substring(0, 8).toUpperCase() : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="bg-success-soft text-success text-xs font-semibold px-2 py-1 rounded-md flex items-center gap-1 border border-success/30">
              <CheckCircle size={14} weight="duotone" /> Ativo
            </span>
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => executarExcluirProduto()}
              disabled={excluindoProduto}
              className="text-danger hover:bg-danger-soft p-1.5 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
              title="Excluir produto"
              aria-label={`Excluir produto ${dadosProduto.nome}`}
            >
              <Trash size={18} weight="duotone" />
            </motion.button>
          </div>
        </div>

        {/* Alerta de conflito 409 ao renomear */}
        {produtoConflito && (
          <div className="bg-card-2 border border-brand/40 rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-ink">
            <span>
              Já existe: <strong className="text-brand">{produtoConflito.nome}</strong>
            </span>
            {onSelecionarProduto && (
              <button
                type="button"
                onClick={() => {
                  setProdutoConflito(null);
                  onSelecionarProduto(produtoConflito.id);
                }}
                className="font-bold underline cursor-pointer ml-2 hover:opacity-80 text-brand"
              >
                Abrir produto existente
              </button>
            )}
          </div>
        )}

        {/* Alerta de erro na recarga em segundo plano */}
        {produto.erroRecarga && (
          <div className="bg-card-2 border border-brand/40 rounded-xl p-3 mb-4 flex items-center justify-between text-xs text-ink">
            <span>Salvo, mas não foi possível atualizar a ficha.</span>
            <button
              type="button"
              onClick={async () => {
                const ok = await produto.recarregar();
                if (ok) {
                  toast.sucesso('Lista atualizada com sucesso.');
                }
              }}
              className="font-bold underline ml-2 cursor-pointer flex items-center gap-1 text-brand"
            >
              <ArrowsClockwise size={14} weight="duotone" /> Tentar novamente
            </button>
          </div>
        )}

        {/* Info Block */}
        <div className="bg-card-2 rounded-xl p-4 border border-line mb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-primary-soft text-primary p-2.5 rounded-xl">
              <Hamburger size={22} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Estrutura de Montagem</p>
              <p className="text-xs text-muted">{dadosProduto.fichasTecnicas?.length || 0} insumos na ficha</p>
            </div>
          </div>
        </div>

        {!mostrandoForm ? (
          <motion.button
            type="button"
            whileTap={tap}
            onClick={() => setMostrandoForm(true)}
            className="w-full bg-primary hover:bg-primary-deep active:opacity-90 text-on-primary rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer min-h-[44px]"
          >
            <Plus size={20} weight="bold" />
            Adicionar Insumo
          </motion.button>
        ) : (
          <div className="bg-card-2 p-4 rounded-xl border border-line mt-2 space-y-3">
            <h3 className="font-semibold text-ink text-sm">Vincular novo Insumo</h3>

            {insumos.erro && (
              <div className="p-3 bg-card border border-brand/40 rounded-xl flex items-center justify-between text-xs text-ink">
                <span>{insumos.erro.mensagem}</span>
                <button
                  type="button"
                  onClick={() => void insumos.tentarNovamente()}
                  className="font-bold underline ml-2 cursor-pointer flex items-center gap-1 text-brand"
                >
                  <ArrowsClockwise size={14} weight="duotone" /> Tentar novamente
                </button>
              </div>
            )}
            {!insumos.erro && insumos.erroRecarga && (
              <div className="p-3 bg-card border border-brand/40 rounded-xl flex items-center justify-between text-xs text-ink">
                <span>{insumos.erroRecarga}</span>
                <button
                  type="button"
                  onClick={() => void insumos.recarregar()}
                  className="font-bold underline ml-2 cursor-pointer flex items-center gap-1 text-brand"
                >
                  <ArrowsClockwise size={14} weight="duotone" /> Tentar novamente
                </button>
              </div>
            )}

            <select
              value={insumoSelecionadoId}
              onChange={(e) => setInsumoSelecionadoId(e.target.value)}
              aria-label="Selecionar insumo"
              className="w-full p-2.5 rounded-lg border border-line text-sm bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione o insumo...</option>
              {(insumos.dados || [])
                .filter((insumo) => !dadosProduto.fichasTecnicas?.some((ft) => ft.insumoId === insumo.id))
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
              className="w-full p-2.5 rounded-lg border border-line text-sm bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <div className="flex gap-2">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setMostrandoForm(false)}
                className="flex-1 bg-field hover:bg-card text-ink py-2.5 rounded-lg font-medium cursor-pointer min-h-[44px] flex items-center justify-center transition-colors"
              >
                Cancelar
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => executarAdicionarInsumo()}
                disabled={adicionandoInsumo}
                className="flex-1 bg-primary hover:bg-primary-deep text-on-primary py-2.5 rounded-lg font-bold disabled:opacity-50 cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                {adicionandoInsumo ? 'Salvando...' : 'Confirmar'}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Ingredientes */}
      <div className="p-4 flex-1">
        <h2 className="text-xs font-bold text-muted tracking-wider mb-3 px-1 uppercase">
          Ingredientes da Receita
        </h2>

        {(!dadosProduto.fichasTecnicas || dadosProduto.fichasTecnicas.length === 0) && !mostrandoForm && (
          <EstadoVazio
            titulo="Nenhum ingrediente na receita"
            descricao={`Adicione os insumos que compõem o "${dadosProduto.nome}" para o sistema saber o desconto exato do estoque em cada venda.`}
            acao={{ texto: 'Adicionar primeiro ingrediente', onClick: () => setMostrandoForm(true) }}
          />
        )}

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-3"
        >
          {dadosProduto.fichasTecnicas?.map((ficha) => {
            const editandoEsta = fichaEditandoId === ficha.id;
            const fatorPerdaNormalizado = Math.max(0, Number(ficha.insumo.fatorPerda) || 0);

            return (
              <motion.div
                key={ficha.id}
                variants={rise}
                className="bg-card rounded-xl border border-line p-4 shadow-sm relative transition-colors"
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-ink truncate text-sm sm:text-base">{ficha.insumo.nome}</h3>
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
                          className="w-28 p-1.5 text-sm rounded-lg border border-line bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                          aria-label={`Editar quantidade de ${ficha.insumo.nome}`}
                        />
                        <span className="text-xs text-muted">{ficha.insumo.unidade}</span>
                        <motion.button
                          type="button"
                          whileTap={tap}
                          onClick={() => executarSalvarEdicao(ficha.id)}
                          disabled={salvandoEdicao}
                          className="p-1.5 bg-success hover:opacity-90 text-white rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 shadow-sm"
                          title="Salvar quantidade"
                          aria-label={`Salvar quantidade de ${ficha.insumo.nome}`}
                        >
                          <Check size={15} weight="bold" />
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={tap}
                          onClick={() => {
                            setFichaEditandoId(null);
                            setQuantidadeEditando('');
                          }}
                          className="p-1.5 bg-field hover:bg-card-2 text-ink rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                          title="Cancelar"
                          aria-label="Cancelar edição de quantidade"
                        >
                          <X size={15} />
                        </motion.button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-bold text-ink text-sm">
                          {formatarQuantidade(ficha.quantidade, ficha.insumo.unidade)}
                        </span>
                        <span className="bg-field text-muted text-[10px] px-2 py-0.5 rounded-full font-medium border border-line">
                          Perda: {Number((fatorPerdaNormalizado * 100).toFixed(1))}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 -mt-1 -mr-1 shrink-0">
                    {!editandoEsta && (
                      <motion.button
                        type="button"
                        whileTap={tap}
                        onClick={() => {
                          setFichaEditandoId(ficha.id);
                          setQuantidadeEditando(String(ficha.quantidade));
                        }}
                        className="text-muted hover:text-ink hover:bg-field p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label={`Editar quantidade de ${ficha.insumo.nome}`}
                        title="Editar quantidade"
                      >
                        <PencilSimple size={17} weight="duotone" />
                      </motion.button>
                    )}
                    <motion.button
                      type="button"
                      whileTap={tap}
                      onClick={() => executarRemoverInsumo(ficha.id, ficha.insumo.nome)}
                      disabled={removendoInsumo}
                      className="text-danger hover:bg-danger-soft p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                      aria-label={`Remover ${ficha.insumo.nome}`}
                      title="Remover ingrediente"
                    >
                      <Trash size={18} weight="duotone" />
                    </motion.button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-line flex justify-between items-center text-xs text-muted">
                  <span>
                    Desconto com perda: {formatarQuantidade(descontoComPerda(ficha.quantidade, ficha.insumo.fatorPerda), ficha.insumo.unidade)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
