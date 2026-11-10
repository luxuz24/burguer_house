import { useState, useCallback } from 'react';
import axios from 'axios';
import { ArrowLeft, CircleNotch, Plus, Trash, PencilSimple, ChefHat, Check, X, Warning } from '../components/ui/icons';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { consumoProducao, formatarQuantidade } from '../lib/formatar';

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

export default function PreparoInterno({ insumoId, onVoltar }: Props) {
  const [brutoId, setBrutoId] = useState('');
  const [qtdNecessaria, setQtdNecessaria] = useState('');
  const [qtdProduzir, setQtdProduzir] = useState('');
  const [editandoBrutoId, setEditandoBrutoId] = useState<string | null>(null);
  const [qtdEditando, setQtdEditando] = useState('');

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
        <div className="w-16 h-16 rounded-full bg-danger-soft/20 flex items-center justify-center mb-4 text-danger">
          <Warning size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Erro ao carregar dados do preparo</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          {erro.mensagem}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="bg-card-2 border border-line text-ink px-4 py-2.5 rounded-xl font-medium cursor-pointer min-h-[44px] flex items-center justify-center hover:bg-field"
          >
            <ArrowLeft size={18} className="mr-2" /> Voltar
          </button>
          <button
            type="button"
            onClick={tentarNovamente}
            className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-medium cursor-pointer min-h-[44px] flex items-center justify-center shadow-sm"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (erro?.tipo === 'nao_encontrado' || !dados?.beneficiado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-field flex items-center justify-center mb-4 text-muted">
          <ChefHat size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Item não encontrado ou não é mais produzido na casa</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          O insumo pode ter sido removido ou sua configuração de produção interna foi desativada.
        </p>
        <button
          type="button"
          onClick={onVoltar}
          className="bg-card-2 border border-line text-ink px-4 py-2.5 rounded-xl font-medium cursor-pointer min-h-[44px] flex items-center justify-center hover:bg-field"
        >
          <ArrowLeft size={18} className="mr-2" /> Voltar ao estoque
        </button>
      </div>
    );
  }

  const { beneficiado, insumos, itens } = dados;
  const qtd = parsearQuantidade(qtdProduzir);

  const previa = itens.map((it) => {
    const consumo = consumoProducao(
      it.quantidadeNecessaria,
      it.insumoBruto?.fatorPerda ?? 0,
      qtd,
    );
    const estoque = it.insumoBruto?.estoqueAtual ?? 0;
    return {
      ...it,
      consumo,
      suficiente: estoque >= consumo,
    };
  });

  const podeProduzir = qtd > 0 && itens.length > 0 && previa.every((p) => p.suficiente) && !produzindo;
  const disponiveis = insumos.filter((i) => i.id !== insumoId && !itens.some((it) => it.insumoBrutoId === i.id));

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink transition-colors">
      {/* Cabeçalho */}
      <div className="bg-card p-4 border-b border-line flex items-center gap-3 transition-colors sticky top-0 z-10">
        <button
          type="button"
          onClick={onVoltar}
          aria-label="Voltar"
          className="text-muted hover:text-ink p-2 rounded-xl hover:bg-field cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-ink leading-tight line-clamp-2">{beneficiado.nome}</h1>
          <p className="text-xs text-muted">
            Estoque: {formatarQuantidade(beneficiado.estoqueAtual, beneficiado.unidade)}
            {beneficiado.validadeDias ? ` • Validade: ${beneficiado.validadeDias} dias` : ''}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Banner de erro de recarga */}
        {erroRecarga && (
          <div
            role="alert"
            className="bg-danger-soft/20 border border-danger/40 text-danger p-3 rounded-xl flex items-center justify-between text-xs"
          >
            <span>{erroRecarga}</span>
            <button
              type="button"
              onClick={() => void recarregar()}
              className="font-bold underline hover:opacity-80 cursor-pointer min-h-[44px] px-2 flex items-center"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Produzir */}
        <section className="bg-card rounded-xl border border-line p-4 space-y-3 transition-colors shadow-sm">
          <h2 className="font-semibold text-ink flex items-center gap-2 text-sm sm:text-base">
            <ChefHat size={18} weight="duotone" className="text-secondary" /> Produzir
          </h2>
          <input
            type="text"
            inputMode="decimal"
            aria-label="Quantidade a produzir"
            placeholder={`Quantidade a produzir (${beneficiado.unidade})`}
            value={qtdProduzir}
            onChange={(e) => setQtdProduzir(e.target.value)}
            className="w-full p-3 border border-line rounded-xl bg-field text-ink placeholder:text-faint min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {qtd > 0 &&
            previa.map((p) => (
              <p
                key={p.id}
                className={`text-sm flex items-center justify-between ${
                  p.suficiente ? 'text-muted' : 'text-danger font-medium'
                }`}
              >
                <span>
                  {p.insumoBruto?.nome}: {formatarQuantidade(p.consumo, p.insumoBruto?.unidade)}
                </span>
                {!p.suficiente && (
                  <span className="text-xs flex items-center gap-1 font-semibold">
                    <Warning size={14} weight="duotone" />
                    (estoque: {formatarQuantidade(p.insumoBruto?.estoqueAtual, p.insumoBruto?.unidade)})
                  </span>
                )}
              </p>
            ))}
          <button
            type="button"
            onClick={() => void executarProduzir()}
            disabled={!podeProduzir}
            className="w-full bg-success hover:bg-success-deep disabled:opacity-40 text-white py-3 rounded-xl font-bold cursor-pointer transition-colors min-h-[44px] shadow-sm flex items-center justify-center gap-2"
          >
            {produzindo ? 'Produzindo...' : `Produzir ${qtd > 0 ? formatarQuantidade(qtd, beneficiado.unidade) : ''}`}
          </button>
          {itens.length === 0 && (
            <p className="text-xs text-faint">Cadastre a sub-ficha abaixo para poder produzir.</p>
          )}
        </section>

        {/* Sub-ficha */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Sub-ficha (por 1 {beneficiado.unidade})
          </h2>
          {itens.map((it) => {
            const editandoEste = editandoBrutoId === it.insumoBrutoId;

            return (
              <div
                key={it.id}
                className="bg-card rounded-xl border border-line p-3 flex justify-between items-center transition-colors shadow-sm"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-semibold text-ink text-sm truncate">{it.insumoBruto?.nome}</p>
                  {editandoEste ? (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        aria-label="Editar quantidade"
                        value={qtdEditando}
                        onChange={(e) => setQtdEditando(e.target.value)}
                        className="w-28 p-2 text-sm rounded-lg border border-primary bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <span className="text-xs text-muted">{it.insumoBruto?.unidade}</span>
                      <button
                        type="button"
                        onClick={() => void executarSalvarEdicao(it.insumoBrutoId)}
                        disabled={salvandoEdicao}
                        className="p-2 bg-success text-white rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-success-deep"
                        aria-label="Salvar quantidade"
                        title="Salvar quantidade"
                      >
                        <Check size={18} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoBrutoId(null);
                          setQtdEditando('');
                        }}
                        disabled={salvandoEdicao}
                        className="p-2 bg-field text-muted rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center hover:text-ink hover:bg-card-2"
                        aria-label="Cancelar edição"
                        title="Cancelar"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      {formatarQuantidade(it.quantidadeNecessaria, it.insumoBruto?.unidade)}
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
                      className="text-primary hover:bg-primary-soft/30 p-2 rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                      aria-label={`Editar ${it.insumoBruto?.nome}`}
                      title="Editar quantidade"
                    >
                      <PencilSimple size={18} weight="duotone" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void executarRemover(it.id, it.insumoBruto?.nome)}
                    disabled={removendo}
                    className="text-danger hover:bg-danger-soft/30 p-2 rounded-lg cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                    aria-label={`Remover ${it.insumoBruto?.nome}`}
                  >
                    <Trash size={18} weight="duotone" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="bg-card rounded-xl border border-line p-3 space-y-3 transition-colors shadow-sm">
            <select
              aria-label="Selecionar insumo bruto"
              value={brutoId}
              onChange={(e) => setBrutoId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line text-sm bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="">Selecione o insumo bruto...</option>
              {disponiveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome} ({i.unidade})
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Quantidade por 1 ${beneficiado.unidade}`}
              placeholder={`Quantidade por 1 ${beneficiado.unidade}`}
              value={qtdNecessaria}
              onChange={(e) => setQtdNecessaria(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line text-sm bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => void executarVincular()}
              disabled={!brutoId || !(parsearQuantidade(qtdNecessaria) > 0) || vinculando}
              className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-[44px] shadow-sm"
            >
              <Plus size={18} weight="bold" /> {vinculando ? 'Adicionando...' : 'Adicionar ingrediente'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
