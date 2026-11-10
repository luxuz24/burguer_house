import { useState, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CircleNotch,
  Plus,
  Minus,
  Trash,
  PencilSimple,
  CookingPot,
  Check,
  X,
  Warning,
  CheckCircle,
  XCircle,
} from '../components/ui/icons';
import Sheet from '../components/ui/Sheet';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { consumoProducao, formatarQuantidade } from '../lib/formatar';
import { stagger, rise, tap } from '../lib/motion';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  fatorPerda?: number;
  estoqueAtual: number;
  produzidoInternamente?: boolean;
  validadeDias?: number | null;
}

interface SubFichaItem {
  id: string;
  insumoBeneficiadoId: string;
  insumoBrutoId: string;
  quantidadeNecessaria: number;
  insumoBruto: Insumo;
}

interface Props {
  insumoId: string;
  onVoltar: () => void;
}

function parsearQuantidade(valor: string): number {
  const normalizado = valor.replace(',', '.').trim();
  const num = Number(normalizado);
  return !normalizado || isNaN(num) ? 0 : num;
}

/** Passo dos botões − e +: 1 para itens contados, 100 para gramas e mililitros. */
function passoDaUnidade(unidade: string): number {
  return /^un/i.test(unidade.trim()) ? 1 : 100;
}

/** Valor do campo com vírgula decimal, como a pessoa digitaria. */
function paraCampo(valor: number): string {
  return String(Number(valor.toFixed(4))).replace('.', ',');
}

export default function PreparoInterno({ insumoId, onVoltar }: Props) {
  const [brutoId, setBrutoId] = useState('');
  const [qtdNecessaria, setQtdNecessaria] = useState('');
  const [qtdProduzir, setQtdProduzir] = useState('');
  const [editandoBrutoId, setEditandoBrutoId] = useState<string | null>(null);
  const [qtdEditando, setQtdEditando] = useState('');
  const [mostrarAdicionar, setMostrarAdicionar] = useState(false);

  const { toast, confirmar } = useFeedback();

  const buscarDados = useCallback(async () => {
    const [resInsumos, resSub] = await Promise.all([
      api.get<Insumo[]>('/insumos'),
      api.get<SubFichaItem[]>(`/preparo-interno/sub-fichas/${insumoId}`),
    ]);
    const todosInsumos = resInsumos.data;
    const beneficiado = todosInsumos.find((i) => i.id === insumoId);
    if (!beneficiado || !beneficiado.produzidoInternamente) {
      const err = new Error('Item não encontrado ou não é mais produzido na casa.') as Error & {
        response: { status: number; data: { message: string } };
      };
      err.response = {
        status: 404,
        data: { message: 'Item não encontrado ou não é mais produzido na casa.' },
      };
      throw err;
    }
    return {
      beneficiado,
      insumos: todosInsumos,
      itens: resSub.data,
    };
  }, [insumoId]);

  const {
    dados,
    carregandoInicial,
    erro,
    erroRecarga,
    recarregar,
    tentarNovamente,
  } = useCarregamento(buscarDados, [insumoId], {
    mensagemPadrao: 'Erro ao carregar dados do preparo.',
  });

  const { enviando: vinculando, executar: executarVincular } = useEnvio(async () => {
    if (!brutoId) {
      toast.aviso('Selecione o insumo bruto.');
      return;
    }
    const qtd = parsearQuantidade(qtdNecessaria);
    if (qtd <= 0) {
      toast.aviso('Informe uma quantidade maior que zero.');
      return;
    }
    const jaExistia = (dados?.itens ?? []).some((it) => it.insumoBrutoId === brutoId);
    try {
      await api.post('/preparo-interno/sub-fichas', {
        insumoBeneficiadoId: insumoId,
        insumoBrutoId: brutoId,
        quantidadeNecessaria: qtd,
      });
      setBrutoId('');
      setQtdNecessaria('');
      setMostrarAdicionar(false);
      const recarregou = await recarregar();
      if (!recarregou) {
        toast.aviso('Salvo, mas não foi possível atualizar os dados em segundo plano.');
      }
      toast.sucesso(jaExistia ? 'Quantidade atualizada na sub-ficha.' : 'Ingrediente adicionado à sub-ficha.');
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
        await recarregar();
      }
      toast.erro(mensagemDeErro(error, 'Erro ao adicionar ingrediente.'));
    }
  });

  const { enviando: salvandoEdicao, executar: executarSalvarEdicao } = useEnvio(async (insumoBrutoId: string) => {
    const qtd = parsearQuantidade(qtdEditando);
    if (qtd <= 0) {
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
      const recarregou = await recarregar();
      if (!recarregou) {
        toast.aviso('Salvo, mas não foi possível atualizar os dados em segundo plano.');
      }
      toast.sucesso('Quantidade atualizada na sub-ficha.');
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
        await recarregar();
      }
      toast.erro(mensagemDeErro(error, 'Erro ao atualizar ingrediente da sub-ficha.'));
    }
  });

  const { enviando: removendo, executar: executarRemover } = useEnvio(async (id: string, nomeBruto?: string) => {
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
      const recarregou = await recarregar();
      if (!recarregou) {
        toast.aviso('Salvo, mas não foi possível atualizar os dados em segundo plano.');
      }
      toast.sucesso('Ingrediente removido da sub-ficha.');
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 400)) {
        await recarregar();
      }
      toast.erro(mensagemDeErro(error, 'Erro ao remover ingrediente.'));
    }
  });

  const { enviando: produzindo, executar: executarProduzir } = useEnvio(async () => {
    const qtdNum = parsearQuantidade(qtdProduzir);
    if (qtdNum <= 0) {
      toast.aviso('Informe uma quantidade válida para produzir.');
      return;
    }
    try {
      await api.post('/preparo-interno/produzir', {
        insumoBeneficiadoId: insumoId,
        quantidade: qtdNum,
      });
      setQtdProduzir('');
      const recarregou = await recarregar();
      if (!recarregou) {
        toast.aviso('Produção registrada, mas não foi possível atualizar os dados em segundo plano.');
      }
      toast.sucesso(
        `Produzido com sucesso: ${formatarQuantidade(qtdNum, dados?.beneficiado.unidade)} de "${dados?.beneficiado.nome}".`,
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          toast.erro(mensagemDeErro(error, 'Estoque insuficiente para produzir.'));
          await recarregar();
          return;
        }
        if (error.response?.status === 404 || error.response?.status === 400) {
          await recarregar();
          return;
        }
      }
      toast.erro(mensagemDeErro(error, 'Erro ao produzir.'));
    }
  });

  if (carregandoInicial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted">
        <CircleNotch className="animate-spin mb-2" size={32} />
        <p>Carregando dados do preparo...</p>
      </div>
    );
  }

  if (erro?.tipo === 'erro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-danger-soft flex items-center justify-center mb-4 text-danger">
          <Warning size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Erro ao carregar dados do preparo</h2>
        <p className="text-sm text-muted max-w-sm mb-6">{erro.mensagem}</p>
        <div className="flex gap-3">
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onVoltar}
            className="bg-card border border-line text-ink px-4 rounded-2xl font-semibold cursor-pointer min-h-[46px] flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} /> Voltar
          </motion.button>
          <motion.button
            type="button"
            whileTap={tap}
            onClick={tentarNovamente}
            className="bg-primary text-on-primary px-4 rounded-2xl font-semibold cursor-pointer min-h-[46px] flex items-center justify-center"
          >
            Tentar novamente
          </motion.button>
        </div>
      </div>
    );
  }

  if (erro?.tipo === 'nao_encontrado' || !dados?.beneficiado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-field flex items-center justify-center mb-4 text-muted">
          <CookingPot size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Item não encontrado ou não é mais produzido na casa</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          O insumo pode ter sido removido ou sua configuração de produção interna foi desativada.
        </p>
        <motion.button
          type="button"
          whileTap={tap}
          onClick={onVoltar}
          className="bg-card border border-line text-ink px-4 rounded-2xl font-semibold cursor-pointer min-h-[46px] flex items-center justify-center gap-2"
        >
          <ArrowLeft size={18} /> Voltar ao estoque
        </motion.button>
      </div>
    );
  }

  const { beneficiado, insumos, itens } = dados;
  const qtd = parsearQuantidade(qtdProduzir);
  const passo = passoDaUnidade(beneficiado.unidade);

  const previa = itens.map((it) => {
    const consumo = consumoProducao(it.quantidadeNecessaria, it.insumoBruto?.fatorPerda ?? 0, qtd);
    const estoque = it.insumoBruto?.estoqueAtual ?? 0;
    return {
      ...it,
      consumo,
      estoque,
      falta: Number(Math.max(0, consumo - estoque).toFixed(4)),
      suficiente: estoque >= consumo,
    };
  });
  const insuficientes = previa.filter((p) => !p.suficiente);

  const podeProduzir = qtd > 0 && itens.length > 0 && insuficientes.length === 0 && !produzindo;
  const disponiveis = insumos.filter((i) => i.id !== insumoId && !itens.some((it) => it.insumoBrutoId === i.id));

  // O motivo do bloqueio fica escrito embaixo do botão, não só no estado desabilitado
  let motivoBloqueio: { texto: string; perigo: boolean } | null = null;
  if (itens.length === 0) {
    motivoBloqueio = { texto: 'Cadastre a receita abaixo para poder produzir.', perigo: false };
  } else if (qtd <= 0) {
    motivoBloqueio = { texto: 'Informe quanto vai produzir.', perigo: false };
  } else if (insuficientes.length > 0) {
    const nomes = insuficientes.map((p) => p.insumoBruto?.nome).join(', ');
    motivoBloqueio = { texto: `Falta ${nomes} para essa quantidade.`, perigo: true };
  }

  const fecharAdicionar = () => {
    setMostrarAdicionar(false);
    setBrutoId('');
    setQtdNecessaria('');
  };

  return (
    <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink transition-colors">
      <div className="px-4 pt-4 space-y-4">
        {/* Cabeçalho: rótulo + nome do item como título */}
        <div className="flex items-start gap-1">
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onVoltar}
            aria-label="Voltar"
            className="text-ink -ml-2 rounded-2xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-field transition-colors"
          >
            <ArrowLeft size={22} />
          </motion.button>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Preparo na casa</p>
            <h1 className="text-xl font-bold text-ink leading-snug line-clamp-2 break-words">{beneficiado.nome}</h1>
          </div>
        </div>

        {/* Banner de erro de recarga */}
        {erroRecarga && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/40 text-danger p-3 rounded-2xl flex items-center justify-between gap-2 text-xs"
          >
            <span>{erroRecarga}</span>
            <button
              type="button"
              onClick={() => void recarregar()}
              className="font-bold underline hover:opacity-80 cursor-pointer min-h-[44px] px-2 flex items-center shrink-0"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Estoque atual do item */}
        <div className="bg-secondary-soft rounded-3xl p-4 flex items-center gap-3">
          <CookingPot size={30} weight="duotone" className="text-secondary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-secondary">Em estoque</p>
            <p className="text-xl font-bold text-ink">{formatarQuantidade(beneficiado.estoqueAtual, beneficiado.unidade)}</p>
          </div>
          {beneficiado.validadeDias ? (
            <p className="text-xs text-secondary text-right leading-tight">
              validade
              <br />
              <strong>{beneficiado.validadeDias} dias</strong>
            </p>
          ) : null}
        </div>

        {/* Quanto vai produzir? */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Quanto vai produzir?</h2>
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => setQtdProduzir(paraCampo(Math.max(0, qtd - passo)))}
              aria-label={`Diminuir ${formatarQuantidade(passo, beneficiado.unidade)}`}
              className="bg-field text-ink rounded-2xl cursor-pointer min-h-[54px] min-w-[54px] flex items-center justify-center"
            >
              <Minus size={20} weight="bold" />
            </motion.button>
            <div className="flex-1 flex items-center bg-field border border-line rounded-2xl px-3 min-h-[54px] focus-within:ring-2 focus-within:ring-primary/40">
              <input
                type="text"
                inputMode="decimal"
                aria-label="Quantidade a produzir"
                placeholder="0"
                value={qtdProduzir}
                onChange={(e) => setQtdProduzir(e.target.value)}
                className="w-full bg-transparent text-center text-2xl font-bold text-ink placeholder:text-faint focus:outline-none"
              />
              <span className="text-sm text-muted shrink-0">{beneficiado.unidade}</span>
            </div>
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => setQtdProduzir(paraCampo(qtd + passo))}
              aria-label={`Aumentar ${formatarQuantidade(passo, beneficiado.unidade)}`}
              className="bg-field text-ink rounded-2xl cursor-pointer min-h-[54px] min-w-[54px] flex items-center justify-center"
            >
              <Plus size={20} weight="bold" />
            </motion.button>
          </div>
        </section>

        {/* Prévia do consumo */}
        {qtd > 0 && previa.length > 0 && (
          <motion.section
            variants={stagger}
            initial="hidden"
            animate="show"
            className="bg-card border border-line rounded-3xl px-4 py-3"
            aria-label="Vai consumir"
          >
            <h2 className="text-sm font-semibold text-ink mb-1">Vai consumir</h2>
            {previa.map((p) => (
              <motion.div key={p.id} variants={rise} className="flex items-center gap-2.5 py-2 border-t border-line">
                {p.suficiente ? (
                  <CheckCircle size={20} weight="fill" className="text-success shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle size={20} weight="fill" className="text-danger shrink-0" aria-hidden="true" />
                )}
                {/* Resumo para leitor de tela; o visual abaixo divide nome, quantidade e estoque */}
                <span className="sr-only">
                  {p.insumoBruto?.nome}: {formatarQuantidade(p.consumo, p.insumoBruto?.unidade)}
                  {p.suficiente ? '' : `, faltam ${formatarQuantidade(p.falta, p.insumoBruto?.unidade)}`}
                  {` (estoque: ${formatarQuantidade(p.estoque, p.insumoBruto?.unidade)})`}
                </span>
                <div className="flex-1 min-w-0" aria-hidden="true">
                  <p className="text-sm text-ink line-clamp-2 break-words">{p.insumoBruto?.nome}</p>
                  <p className={`text-xs ${p.suficiente ? 'text-muted' : 'text-danger font-medium'}`}>
                    {p.suficiente
                      ? `tem ${formatarQuantidade(p.estoque, p.insumoBruto?.unidade)}`
                      : `faltam ${formatarQuantidade(p.falta, p.insumoBruto?.unidade)} · tem ${formatarQuantidade(p.estoque, p.insumoBruto?.unidade)}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-ink shrink-0" aria-hidden="true">
                  {formatarQuantidade(p.consumo, p.insumoBruto?.unidade)}
                </p>
              </motion.div>
            ))}
          </motion.section>
        )}

        {/* Produzir */}
        <div className="space-y-1.5">
          <motion.button
            type="button"
            whileTap={podeProduzir ? tap : undefined}
            onClick={() => void executarProduzir()}
            disabled={!podeProduzir}
            className="w-full bg-success text-white rounded-2xl font-bold min-h-[50px] flex items-center justify-center gap-2 cursor-pointer transition-colors hover:opacity-90 disabled:bg-field disabled:text-faint disabled:border disabled:border-dashed disabled:border-line disabled:cursor-not-allowed"
          >
            <CookingPot size={20} weight="duotone" />
            {produzindo ? 'Produzindo...' : `Produzir ${qtd > 0 ? formatarQuantidade(qtd, beneficiado.unidade) : ''}`}
          </motion.button>
          {motivoBloqueio && !produzindo && (
            <p className={`text-xs text-center ${motivoBloqueio.perigo ? 'text-danger' : 'text-muted'}`}>
              {motivoBloqueio.texto}
            </p>
          )}
        </div>

        {/* Receita (sub-ficha) */}
        <section className="space-y-2 pt-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Receita por 1 {beneficiado.unidade}
          </h2>
          <div className="bg-card border border-line rounded-3xl px-4">
            <motion.div variants={stagger} initial="hidden" animate="show">
              {itens.map((it) => {
                const editandoEste = editandoBrutoId === it.insumoBrutoId;
                return (
                  <motion.div key={it.id} variants={rise} className="py-2.5 border-b border-line">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 min-w-0 text-sm text-ink line-clamp-2 break-words">{it.insumoBruto?.nome}</p>
                      {!editandoEste && (
                        <p className="text-sm font-bold text-ink shrink-0">
                          {formatarQuantidade(it.quantidadeNecessaria, it.insumoBruto?.unidade)}
                        </p>
                      )}
                      {!editandoEste && (
                        <motion.button
                          type="button"
                          whileTap={tap}
                          onClick={() => {
                            setEditandoBrutoId(it.insumoBrutoId);
                            setQtdEditando(String(it.quantidadeNecessaria).replace('.', ','));
                          }}
                          className="text-muted hover:text-ink rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                          aria-label={`Editar ${it.insumoBruto?.nome}`}
                          title="Editar quantidade"
                        >
                          <PencilSimple size={18} />
                        </motion.button>
                      )}
                      <motion.button
                        type="button"
                        whileTap={tap}
                        onClick={() => void executarRemover(it.id, it.insumoBruto?.nome)}
                        disabled={removendo}
                        className="text-danger rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors hover:bg-danger-soft"
                        aria-label={`Remover ${it.insumoBruto?.nome}`}
                      >
                        <Trash size={18} />
                      </motion.button>
                    </div>
                    {editandoEste && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 flex items-center bg-field border border-primary rounded-xl px-3 min-h-[44px]">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            aria-label="Editar quantidade"
                            value={qtdEditando}
                            onChange={(e) => setQtdEditando(e.target.value)}
                            className="w-full bg-transparent text-sm text-ink focus:outline-none"
                          />
                          <span className="text-xs text-muted shrink-0">{it.insumoBruto?.unidade}</span>
                        </div>
                        <motion.button
                          type="button"
                          whileTap={tap}
                          onClick={() => void executarSalvarEdicao(it.insumoBrutoId)}
                          disabled={salvandoEdicao}
                          className="bg-success text-white rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center hover:opacity-90"
                          aria-label="Salvar quantidade"
                          title="Salvar quantidade"
                        >
                          <Check size={18} weight="bold" />
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={tap}
                          onClick={() => {
                            setEditandoBrutoId(null);
                            setQtdEditando('');
                          }}
                          disabled={salvandoEdicao}
                          className="bg-field text-muted rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-ink"
                          aria-label="Cancelar edição"
                          title="Cancelar"
                        >
                          <X size={18} />
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => setMostrarAdicionar(true)}
              className="w-full flex items-center gap-1.5 py-3 text-sm font-semibold text-secondary cursor-pointer min-h-[44px]"
            >
              <Plus size={16} weight="bold" /> Adicionar ingrediente
            </motion.button>
          </div>
        </section>
      </div>

      {/* Adicionar ingrediente à receita */}
      <Sheet
        open={mostrarAdicionar}
        onClose={fecharAdicionar}
        title="Adicionar ingrediente"
        subtitle={`Receita de ${beneficiado.nome}`}
        icon={<CookingPot size={22} weight="duotone" />}
        footer={
          <motion.button
            type="button"
            whileTap={tap}
            onClick={() => void executarVincular()}
            disabled={!brutoId || !(parsearQuantidade(qtdNecessaria) > 0) || vinculando}
            className="w-full bg-primary text-on-primary rounded-2xl font-bold min-h-[50px] flex items-center justify-center gap-2 cursor-pointer disabled:bg-field disabled:text-faint disabled:cursor-not-allowed"
          >
            {vinculando ? 'Adicionando...' : 'Adicionar à receita'}
          </motion.button>
        }
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="preparo-bruto" className="block text-xs font-semibold text-muted mb-1">
              Insumo bruto
            </label>
            <select
              id="preparo-bruto"
              aria-label="Selecionar insumo bruto"
              value={brutoId}
              onChange={(e) => setBrutoId(e.target.value)}
              className="w-full px-3 rounded-2xl border border-line text-sm bg-field text-ink min-h-[46px] focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="">Selecione o insumo bruto...</option>
              {disponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} ({i.unidade})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="preparo-qtd" className="block text-xs font-semibold text-muted mb-1">
              Quantidade para 1 {beneficiado.unidade}
            </label>
            <input
              id="preparo-qtd"
              type="text"
              inputMode="decimal"
              aria-label={`Quantidade por 1 ${beneficiado.unidade}`}
              placeholder="0"
              value={qtdNecessaria}
              onChange={(e) => setQtdNecessaria(e.target.value)}
              className="w-full px-3 rounded-2xl border border-line text-lg font-bold bg-field text-ink placeholder:text-faint min-h-[50px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
