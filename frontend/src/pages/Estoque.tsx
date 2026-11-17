import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import { useCarregamento } from '../hooks/useCarregamento';
import { stagger, rise, tap } from '../lib/motion';
import EstadoVazio from '../components/EstadoVazio';
import FichaTecnica from './FichaTecnica';
import PreparoInterno from './PreparoInterno';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import { Plus, PencilSimple, Trash, Package, Warning, ChefHat, QrCode, MagnifyingGlass, CookingPot, Hamburger, CaretRight } from '../components/ui/icons';
import Sheet from '../components/ui/Sheet';
import { formatarQuantidade, normalizarBusca } from '../lib/formatar';
import VendasRetidasPainel from '../components/VendasRetidasPainel';
import {
  buscarVendasRetidas,
  mesclarPaginasRetidas,
  normalizarRespostaRetidas,
  type AcaoVendaRetida,
  type VendasRetidasResposta,
} from '../lib/vendasRetidas';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  custoUnitario?: number;
  fatorPerda?: number;
  produzidoInternamente?: boolean;
  validadeDias?: number | null;
  atualizadoEm?: string;
}

function calcularValidade(insumo: Insumo) {
  if (!insumo.produzidoInternamente || !insumo.validadeDias || !insumo.atualizadoEm || insumo.estoqueAtual <= 0) {
    return null;
  }
  const atualizado = new Date(insumo.atualizadoEm).getTime();
  const validadeMs = insumo.validadeDias * 86_400_000;
  const expiraEm = atualizado + validadeMs;
  const diffDias = Math.ceil((expiraEm - Date.now()) / 86_400_000);
  return {
    diasRestantes: diffDias,
    vencido: diffDias <= 0,
    alerta: diffDias > 0 && diffDias <= 2,
  };
}

function estaCritico(insumo: Insumo): boolean {
  return insumo.estoqueMinimo > 0
    ? insumo.estoqueAtual <= insumo.estoqueMinimo
    : insumo.estoqueAtual <= 0;
}

function temAlerta(insumo: Insumo): boolean {
  const val = calcularValidade(insumo);
  return estaCritico(insumo) || (val ? val.vencido || val.alerta : false);
}

interface FormInsumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number | '';
  estoqueMinimo: number | '';
  custoUnitario: number | '';
  fatorPerdaPct: number | '';
  produzidoInternamente?: boolean;
  validadeDias?: number | '';
}

const formInsumoVazio: FormInsumo = {
  id: '',
  nome: '',
  unidade: 'Gramas',
  estoqueAtual: '',
  estoqueMinimo: '',
  custoUnitario: '',
  fatorPerdaPct: '',
  produzidoInternamente: false,
  validadeDias: '',
};

interface Produto {
  id: string;
  nome: string;
}

export interface DestinoEstoque {
  seq: number;
  aba: 'insumos' | 'produtos';
  acaoRetida?: AcaoVendaRetida;
}

interface EstoqueProps {
  destinoInicial?: DestinoEstoque | null;
}

export default function Estoque({ destinoInicial }: EstoqueProps = {}) {
  const acaoInicial = destinoInicial?.acaoRetida;
  const [abaAtiva, setAbaAtiva] = useState<'insumos' | 'produtos'>(destinoInicial?.aba ?? 'insumos');
  
  // Estados para Insumos
  const [mostrarFormInsumo, setMostrarFormInsumo] = useState(false);
  const [formInsumo, setFormInsumo] = useState<FormInsumo>(formInsumoVazio);
  const [beneficiadoSelecionadoId, setBeneficiadoSelecionadoId] = useState<string | null>(null);
  const [filtroInsumos, setFiltroInsumos] = useState<'todos' | 'beneficiados' | 'alertas'>('todos');
  const [busca, setBusca] = useState(
    acaoInicial?.tipo === 'COLISAO_NOME' ? acaoInicial.produto : '',
  );
  const [mostrarImportarNota, setMostrarImportarNota] = useState(false);

  // Estados para Produtos e vendas retidas
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string | null>(null);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(
    acaoInicial?.tipo === 'PRODUTO_NAO_ENCONTRADO',
  );
  const [nomeNovoProduto, setNomeNovoProduto] = useState(
    acaoInicial?.tipo === 'PRODUTO_NAO_ENCONTRADO' ? acaoInicial.produto : '',
  );
  const [produtoConflito, setProdutoConflito] = useState<{ id: string; nome: string } | null>(null);
  const [acaoInicialConsumida, setAcaoInicialConsumida] = useState(false);
  const [paginasRetidas, setPaginasRetidas] = useState<{
    baseRef: VendasRetidasResposta | null | undefined;
    dado: VendasRetidasResposta;
  } | null>(null);
  const [carregandoMaisRetidas, setCarregandoMaisRetidas] = useState(false);

  const { toast, confirmar } = useFeedback();

  const buscarInsumos = useCallback(() => api.get<Insumo[]>('/insumos').then((r) => r.data), []);
  const buscarProdutos = useCallback(() => api.get<Produto[]>('/produtos').then((r) => r.data), []);

  const {
    dados: insumosDados,
    carregandoInicial: carregandoInsumos,
    erro: erroInsumos,
    erroRecarga: erroRecargaInsumos,
    recarregar: recarregarInsumos,
  } = useCarregamento(buscarInsumos, [], {
    habilitado: abaAtiva === 'insumos',
    mensagemPadrao: 'Erro ao carregar insumos.',
  });

  const {
    dados: produtosDados,
    carregandoInicial: carregandoProdutos,
    erro: erroProdutos,
    erroRecarga: erroRecargaProdutos,
    recarregar: recarregarProdutos,
  } = useCarregamento(buscarProdutos, [], {
    habilitado: abaAtiva === 'produtos',
    mensagemPadrao: 'Erro ao carregar produtos.',
  });

  const { dados: retidasBase, recarregar: recarregarRetidas } = useCarregamento(buscarVendasRetidas, [], {
    habilitado: abaAtiva === 'produtos',
    mensagemPadrao: '',
  });

  const insumos = insumosDados ?? [];
  const produtos = produtosDados ?? [];
  const retidasExibidas =
    paginasRetidas && paginasRetidas.baseRef === retidasBase ? paginasRetidas.dado : retidasBase;

  const produtoInicialSemFichaId =
    !acaoInicialConsumida && acaoInicial?.tipo === 'PRODUTO_SEM_FICHA' && produtosDados
      ? (produtosDados.find((p) => normalizarBusca(p.nome) === normalizarBusca(acaoInicial.produto))
          ?.id ?? null)
      : null;
  const produtoAbertoId = produtoSelecionadoId ?? produtoInicialSemFichaId;

  const carregarMaisRetidas = useCallback(async () => {
    if (!retidasExibidas || !retidasExibidas.temMais || carregandoMaisRetidas) return;
    setCarregandoMaisRetidas(true);
    try {
      const resp = await api.get('/vendas/retidas', {
        params: {
          limite: retidasExibidas.limite,
          offset: retidasExibidas.offset + retidasExibidas.limite,
        },
      });
      const proxima = normalizarRespostaRetidas(resp.data);
      if (!proxima) return;
      setPaginasRetidas({
        baseRef: retidasBase,
        dado: mesclarPaginasRetidas(retidasExibidas, proxima),
      });
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao carregar mais vendas retidas.'));
    } finally {
      setCarregandoMaisRetidas(false);
    }
  }, [retidasBase, retidasExibidas, carregandoMaisRetidas, toast]);

  const executarAcaoRetida = useCallback(
    (acao: AcaoVendaRetida, listaProdutos: Produto[]) => {
      if (acao.tipo === 'PRODUTO_NAO_ENCONTRADO') {
        setBusca('');
        setProdutoConflito(null);
        setNomeNovoProduto(acao.produto);
        setMostrarFormProduto(true);
        return;
      }
      if (acao.tipo === 'PRODUTO_SEM_FICHA') {
        const alvo = listaProdutos.find(
          (p) => normalizarBusca(p.nome) === normalizarBusca(acao.produto),
        );
        if (alvo) {
          setProdutoSelecionadoId(alvo.id);
        } else {
          setBusca(acao.produto);
          toast.aviso(`Selecione "${acao.produto}" para montar a ficha técnica.`);
        }
        return;
      }
      if (acao.tipo === 'COLISAO_NOME') {
        setBusca(acao.produto);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (abaAtiva === 'insumos' && erroInsumos) {
      toast.erro(erroInsumos.mensagem);
    }
  }, [abaAtiva, erroInsumos, toast]);

  useEffect(() => {
    if (abaAtiva === 'insumos' && erroRecargaInsumos) {
      toast.erro(erroRecargaInsumos);
    }
  }, [abaAtiva, erroRecargaInsumos, toast]);

  useEffect(() => {
    if (abaAtiva === 'produtos' && erroProdutos) {
      toast.erro(erroProdutos.mensagem);
    }
  }, [abaAtiva, erroProdutos, toast]);

  useEffect(() => {
    if (abaAtiva === 'produtos' && erroRecargaProdutos) {
      toast.erro(erroRecargaProdutos);
    }
  }, [abaAtiva, erroRecargaProdutos, toast]);

  const { enviando: salvandoInsumo, executar: executarSalvarInsumo } = useEnvio(async () => {
    const nome = formInsumo.nome.trim();
    if (!nome) {
      toast.erro('O nome do insumo é obrigatório.');
      return;
    }

    if (formInsumo.fatorPerdaPct !== '') {
      const pct = Number(formInsumo.fatorPerdaPct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.erro('Fator de perda deve estar entre 0% e 100%.');
        return;
      }
    }

    const editando = !!formInsumo.id;
    const basePayload = {
      nome,
      unidade: formInsumo.unidade,
      estoqueMinimo: formInsumo.estoqueMinimo === '' ? 0 : Number(formInsumo.estoqueMinimo),
      custoUnitario: formInsumo.custoUnitario === '' ? 0 : Number(formInsumo.custoUnitario),
      fatorPerda: formInsumo.fatorPerdaPct === '' ? 0 : Number((Number(formInsumo.fatorPerdaPct) / 100).toFixed(4)),
      produzidoInternamente: formInsumo.produzidoInternamente,
      validadeDias: formInsumo.produzidoInternamente && formInsumo.validadeDias !== '' ? Number(formInsumo.validadeDias) : null,
    };

    try {
      if (editando) {
        await api.put(`/insumos/${formInsumo.id}`, basePayload);
      } else {
        await api.post('/insumos', {
          ...basePayload,
          estoqueAtual: formInsumo.estoqueAtual === '' ? 0 : Number(formInsumo.estoqueAtual),
        });
      }
      setMostrarFormInsumo(false);
      setFormInsumo(formInsumoVazio);
      await recarregarInsumos();
      toast.sucesso(editando ? `"${basePayload.nome}" atualizado.` : `"${basePayload.nome}" cadastrado.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao salvar insumo.'));
    }
  });

  const deletarInsumo = async (insumo: Insumo) => {
    const ok = await confirmar({
      titulo: 'Apagar insumo',
      mensagem: `Deseja realmente apagar "${insumo.nome}"? Esta ação não pode ser desfeita.`,
      textoConfirmar: 'Apagar',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/insumos/${insumo.id}`);
      await recarregarInsumos();
      toast.sucesso(`"${insumo.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Falha ao apagar insumo (pode estar em uso em uma ficha técnica).'));
    }
  };

  const { enviando: criandoProduto, executar: executarCriarProduto } = useEnvio(async () => {
    const nome = nomeNovoProduto.trim();
    if (!nome) {
      toast.erro('O nome do produto é obrigatório.');
      return;
    }
    try {
      const res = await api.post('/produtos', { nome });
      setNomeNovoProduto('');
      setMostrarFormProduto(false);
      setProdutoConflito(null);
      await recarregarProdutos();
      void recarregarRetidas();
      toast.sucesso(`Produto "${nome}" criado! Adicione os ingredientes da ficha técnica.`);
      if (res.data?.id) {
        setProdutoSelecionadoId(res.data.id);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409 && error.response.data?.produtoConflito) {
        setProdutoConflito(error.response.data.produtoConflito);
      }
      toast.erro(mensagemDeErro(error, 'Erro ao criar produto.'));
    }
  });

  const deletarProduto = async (prod: Produto, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmar({
      titulo: 'Apagar produto',
      mensagem: `Deseja realmente apagar o produto "${prod.nome}" e sua ficha técnica?`,
      textoConfirmar: 'Apagar',
      perigoso: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/produtos/${prod.id}`);
      await recarregarProdutos();
      void recarregarRetidas();
      toast.sucesso(`Produto "${prod.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao apagar produto.'));
    }
  };

  const termo = normalizarBusca(busca);
  const casaComBusca = (nome: string) => !termo || normalizarBusca(nome).includes(termo);
  const insumosFiltrados = insumos.filter((insumo) => {
    if (!casaComBusca(insumo.nome)) return false;
    if (filtroInsumos === 'beneficiados') return !!insumo.produzidoInternamente;
    if (filtroInsumos === 'alertas') return temAlerta(insumo);
    return true;
  });

  const totalAlertas = insumos.filter(temAlerta).length;
  const produtosFiltrados = produtos.filter((prod) => casaComBusca(prod.nome));

  // Se um produto foi selecionado, renderiza a tela de Ficha Técnica (e passa prop para voltar)
  if (produtoAbertoId) {
    return (
      <FichaTecnica
        key={produtoAbertoId}
        produtoId={produtoAbertoId}
        onVoltar={() => {
          setProdutoSelecionadoId(null);
          setAcaoInicialConsumida(true);
          void recarregarProdutos();
          void recarregarRetidas();
        }}
        onSelecionarProduto={(id) => {
          setAcaoInicialConsumida(true);
          setProdutoSelecionadoId(id);
        }}
      />
    );
  }

  if (beneficiadoSelecionadoId) {
    return <PreparoInterno insumoId={beneficiadoSelecionadoId} onVoltar={() => { setBeneficiadoSelecionadoId(null); void recarregarInsumos(); }} />;
  }

  if (mostrarImportarNota) {
    return <ImportarNotaFiscal onVoltar={() => { setMostrarImportarNota(false); void recarregarInsumos(); }} />;
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink transition-colors">
      
      {/* Título, nota fiscal e abas */}
      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-ink">Estoque</h1>
          {abaAtiva === 'insumos' && (
            <motion.button
              type="button"
              whileTap={tap}
              onClick={() => setMostrarImportarNota(true)}
              aria-label="Importar NF-e"
              title="Importar nota fiscal"
              className="w-11 h-11 rounded-2xl bg-secondary-soft text-secondary flex items-center justify-center cursor-pointer"
            >
              <QrCode size={22} weight="duotone" />
            </motion.button>
          )}
        </div>
        <div className="flex bg-field rounded-2xl p-1 gap-1">
          {([['insumos', 'Insumos', 'Insumos Brutos'], ['produtos', 'Produtos', 'Produtos Prontos']] as const).map(([id, texto, nome]) => (
            <button
              key={id}
              type="button"
              aria-pressed={abaAtiva === id}
              aria-label={nome}
              onClick={() => { setAbaAtiva(id); setBusca(''); }}
              className={`flex-1 rounded-xl min-h-[40px] text-sm font-semibold cursor-pointer transition-colors ${
                abaAtiva === id ? 'bg-card text-ink shadow-sm' : 'text-muted'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
          <MagnifyingGlass size={18} className="text-muted shrink-0" />
          <input
            aria-label={abaAtiva === 'insumos' ? 'Buscar insumo' : 'Buscar produto'}
            placeholder={abaAtiva === 'insumos' ? 'Buscar insumo' : 'Buscar produto'}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </div>
      </div>

      <div className="p-4">
        {abaAtiva === 'insumos' && (
          <div className="space-y-4">
            {/* Cadastro e edição de insumo (Sheet) */}
            <Sheet
              open={mostrarFormInsumo}
              onClose={() => setMostrarFormInsumo(false)}
              title={formInsumo.id ? 'Editar insumo' : 'Novo insumo'}
              icon={<Package size={22} weight="duotone" />}
            >
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void executarSalvarInsumo();
                }}
                className="space-y-3 pb-2"
              >
                
                <div className="flex gap-2">
                  <input
                    required
                    aria-label="Nome do insumo"
                    placeholder="Nome (ex: Maionese)"
                    value={formInsumo.nome}
                    onChange={e => setFormInsumo({...formInsumo, nome: e.target.value})}
                    className="flex-1 p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <select
                    aria-label="Unidade de medida"
                    value={formInsumo.unidade}
                    onChange={e => setFormInsumo({...formInsumo, unidade: e.target.value})}
                    className="p-2 border border-line rounded-lg bg-field text-ink w-28 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="Gramas">g</option>
                    <option value="Unidades">un</option>
                    <option value="Mililitros">ml</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="estoque-atual-input" className="text-xs text-muted ml-1">
                      Estoque Atual {formInsumo.id && <span className="text-[10px] text-faint">(ajustado por movimentações)</span>}
                    </label>
                    <input
                      id="estoque-atual-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      aria-label="Estoque Atual"
                      disabled={!!formInsumo.id}
                      value={formInsumo.estoqueAtual}
                      onChange={e => setFormInsumo({...formInsumo, estoqueAtual: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="estoque-minimo-input" className="text-xs text-muted ml-1">Mínimo Seguro</label>
                    <input
                      id="estoque-minimo-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      aria-label="Mínimo Seguro"
                      value={formInsumo.estoqueMinimo}
                      onChange={e => setFormInsumo({...formInsumo, estoqueMinimo: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="custo-unitario-input" className="text-xs text-muted ml-1">Custo Unit. (R$)</label>
                    <input
                      id="custo-unitario-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.0001"
                      placeholder="0,00"
                      aria-label="Custo Unitário"
                      value={formInsumo.custoUnitario}
                      onChange={e => setFormInsumo({...formInsumo, custoUnitario: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="fator-perda-input" className="text-xs text-muted ml-1">Fator Perda (%)</label>
                    <input
                      id="fator-perda-input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0%"
                      aria-label="Fator Perda"
                      value={formInsumo.fatorPerdaPct}
                      onChange={e => setFormInsumo({...formInsumo, fatorPerdaPct: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink placeholder:text-faint min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink ml-1 min-h-[44px] cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Produzido na casa (item beneficiado)"
                    checked={formInsumo.produzidoInternamente}
                    onChange={e => {
                      const marcado = e.target.checked;
                      setFormInsumo(prev => ({
                        ...prev,
                        produzidoInternamente: marcado,
                        validadeDias: marcado ? prev.validadeDias : '',
                      }));
                    }}
                  />
                  Produzido na casa (item beneficiado)
                </label>
                {formInsumo.produzidoInternamente && (
                  <div>
                    <label htmlFor="validade-dias-input" className="text-xs text-muted ml-1">Validade (dias)</label>
                    <input
                      id="validade-dias-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      aria-label="Validade em dias"
                      value={formInsumo.validadeDias}
                      onChange={e => setFormInsumo({...formInsumo, validadeDias: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-line rounded-lg bg-field text-ink min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <motion.button
                    type="button"
                    whileTap={tap}
                    onClick={() => setMostrarFormInsumo(false)}
                    className="flex-1 bg-field hover:bg-card-2 text-ink py-2 rounded-lg font-medium cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileTap={tap}
                    disabled={salvandoInsumo}
                    className="flex-1 bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary py-2 rounded-lg font-bold cursor-pointer min-h-[44px] shadow-sm"
                  >
                    {salvandoInsumo ? 'Salvando...' : 'Salvar'}
                  </motion.button>
                </div>
              </form>
            </Sheet>

            {/* Filtros de Insumos */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setFiltroInsumos('todos')}
                className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap min-h-[44px] flex items-center ${
                  filtroInsumos === 'todos'
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-field text-muted hover:text-ink font-medium'
                }`}
              >
                Todos ({insumos.length})
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setFiltroInsumos('beneficiados')}
                className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                  filtroInsumos === 'beneficiados'
                    ? 'bg-secondary text-on-secondary font-bold shadow-sm'
                    : 'bg-field text-muted hover:text-ink font-medium'
                }`}
              >
                <ChefHat size={14} weight="duotone" /> Preparo Interno ({insumos.filter(i => i.produzidoInternamente).length})
              </motion.button>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setFiltroInsumos('alertas')}
                className={`px-3 py-1.5 rounded-full transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                  filtroInsumos === 'alertas'
                    ? 'bg-danger text-canvas font-bold shadow-sm'
                    : 'bg-field text-muted hover:text-ink font-medium'
                }`}
              >
                <Warning size={14} weight="duotone" /> Alertas ({totalAlertas})
              </motion.button>
            </div>

            {/* Lista Insumos Cards */}
            <div className="space-y-3">
              {carregandoInsumos && insumos.length === 0 && (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-field animate-pulse" />
                  ))}
                </div>
              )}

              {!carregandoInsumos && insumos.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum insumo cadastrado"
                  descricao="Cadastre os ingredientes e embalagens da casa para começar a controlar o estoque."
                  acao={{ texto: 'Cadastrar primeiro insumo', onClick: () => { setFormInsumo(formInsumoVazio); setMostrarFormInsumo(true); } }}
                />
              )}

              {/* Com busca, o vazio é "nada encontrado"; as mensagens dos filtros abaixo só valem sem busca */}
              {insumos.length > 0 && termo && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum insumo encontrado"
                  descricao={`Nada corresponde a "${busca.trim()}"${filtroInsumos === 'todos' ? '' : ' neste filtro'}.`}
                />
              )}

              {insumos.length > 0 && !termo && filtroInsumos === 'alertas' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Tudo em ordem por aqui"
                  descricao="Nenhum insumo abaixo do mínimo ou perto de vencer."
                />
              )}

              {insumos.length > 0 && !termo && filtroInsumos === 'beneficiados' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum item de preparo interno"
                  descricao='Marque "Produzido internamente" ao cadastrar um insumo (ex.: maionese da casa) para controlar produção e validade.'
                />
              )}

              <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {insumosFiltrados.map(insumo => {
                  const isCritico = estaCritico(insumo);
                  const val = calcularValidade(insumo);

                  return (
                    <motion.div
                      key={insumo.id}
                      variants={rise}
                      className={`bg-card rounded-xl border p-4 shadow-sm relative overflow-hidden transition-colors ${
                        val?.vencido
                          ? 'border-danger bg-danger-soft/20'
                          : isCritico || val?.alerta
                          ? 'border-brand/50'
                          : 'border-line'
                      }`}
                    >
                      {isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-danger"></div>}
                      {val?.vencido && !isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-danger"></div>}
                      {val?.alerta && !isCritico && !val.vencido && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand"></div>}
                      
                      <div className="flex justify-between items-start pl-2">
                        <div className="flex-1 pr-2 min-w-0">
                          <div>
                            <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug break-words">
                              {insumo.nome}
                            </h3>
                            {insumo.produzidoInternamente && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 bg-secondary-soft text-secondary text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                  <CookingPot size={11} /> Da casa
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted mt-1">
                            Estoque:{' '}
                            <span className={`font-bold whitespace-nowrap ${isCritico ? 'text-danger' : 'text-ink'}`}>
                              {formatarQuantidade(insumo.estoqueAtual, insumo.unidade)}
                            </span>
                          </p>

                          {isCritico && (
                            <p className="text-xs text-danger mt-0.5 flex items-center gap-1 font-medium">
                              <Warning size={12} weight="duotone" /> {insumo.estoqueAtual <= 0 ? 'Sem estoque' : `Abaixo do mínimo (${insumo.estoqueMinimo})`}
                            </p>
                          )}

                          {val?.vencido && (
                            <p className="text-xs text-danger font-bold mt-0.5 flex items-center gap-1">
                              <Warning size={12} weight="duotone" /> Vencido há {Math.abs(val.diasRestantes)} dia(s)!
                            </p>
                          )}

                          {val?.alerta && (
                            <p className="text-xs text-brand font-bold mt-0.5 flex items-center gap-1">
                              <Warning size={12} weight="duotone" /> Perto de vencer ({val.diasRestantes} dia(s) restante(s))
                            </p>
                          )}

                          {val && !val.vencido && !val.alerta && (
                            <p className="text-xs text-success mt-0.5 flex items-center gap-1 font-medium">
                              ✓ Válido por mais {val.diasRestantes} dia(s)
                            </p>
                          )}

                          {insumo.produzidoInternamente && !val && insumo.validadeDias && (
                            <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
                              <ChefHat size={12} weight="duotone" /> Produzido na casa • validade {insumo.validadeDias}d
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1 items-center shrink-0">
                          {insumo.produzidoInternamente && (
                            <motion.button
                              type="button"
                              whileTap={tap}
                              onClick={() => setBeneficiadoSelecionadoId(insumo.id)}
                              title="Produzir ou configurar sub-ficha"
                              aria-label={`Produzir ${insumo.nome}`}
                              className="bg-secondary-soft hover:bg-secondary/20 text-secondary px-2 sm:px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer min-h-[44px] min-w-[44px]"
                            >
                              <ChefHat size={16} weight="duotone" />
                              <span className="hidden sm:inline">Produzir</span>
                            </motion.button>
                          )}
                          <motion.button
                            type="button"
                            whileTap={tap}
                            aria-label={`Editar ${insumo.nome}`}
                            onClick={() => {
                              setFormInsumo({
                                id: insumo.id,
                                nome: insumo.nome,
                                unidade: insumo.unidade,
                                estoqueAtual: insumo.estoqueAtual,
                                estoqueMinimo: insumo.estoqueMinimo,
                                custoUnitario: insumo.custoUnitario ?? '',
                                fatorPerdaPct: insumo.fatorPerda ? Number((insumo.fatorPerda * 100).toFixed(2)) : '',
                                produzidoInternamente: insumo.produzidoInternamente,
                                validadeDias: insumo.validadeDias ?? '',
                              });
                              setMostrarFormInsumo(true);
                            }}
                            className="text-secondary hover:bg-field p-2 rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <PencilSimple size={18} weight="duotone" />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={tap}
                            aria-label={`Excluir ${insumo.nome}`}
                            onClick={() => deletarInsumo(insumo)}
                            className="text-danger hover:bg-danger-soft/30 p-2 rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash size={18} weight="duotone" />
                          </motion.button>
                        </div>
                      </div>
                      {/* Nível do estoque em relação ao mínimo (cheia = 2× o mínimo) */}
                      <div className="pl-2 mt-2.5">
                        <div className="h-1.5 rounded-full bg-card-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isCritico || val?.vencido ? 'bg-danger' : 'bg-success'}`}
                            style={{
                              width: `${
                                insumo.estoqueMinimo > 0
                                  ? Math.min(insumo.estoqueAtual / (insumo.estoqueMinimo * 2), 1) * 100
                                  : insumo.estoqueAtual > 0 ? 100 : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="text-[11px] text-muted mt-1">mínimo {formatarQuantidade(insumo.estoqueMinimo, insumo.unidade)}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* Ação principal da aba, fixa acima da barra inferior */}
            <div className="sticky bottom-20 pt-1 z-10">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => { setFormInsumo(formInsumoVazio); setMostrarFormInsumo(true); }}
                className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold flex items-center justify-center gap-2 shadow-primary cursor-pointer"
              >
                <Plus size={20} weight="bold" /> Novo insumo
              </motion.button>
            </div>
          </div>
        )}

        {abaAtiva === 'produtos' && (
          <div className="space-y-3">
            <VendasRetidasPainel
              dados={retidasExibidas}
              onCorrigirItem={(acao) => executarAcaoRetida(acao, produtos)}
              onCarregarMais={retidasExibidas?.temMais ? carregarMaisRetidas : undefined}
              carregandoMais={carregandoMaisRetidas}
            />
            <Sheet
              open={mostrarFormProduto}
              onClose={() => { setMostrarFormProduto(false); setNomeNovoProduto(''); setProdutoConflito(null); }}
              title="Novo produto"
              icon={<Hamburger size={22} weight="duotone" />}
            >
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void executarCriarProduto();
                }}
                className="space-y-3 pb-2"
              >
                <input
                  type="text"
                  autoFocus
                  required
                  aria-label="Nome do novo produto"
                  placeholder="Ex.: X-Bacon"
                  value={nomeNovoProduto}
                  onChange={(e) => {
                    setNomeNovoProduto(e.target.value);
                    if (produtoConflito) setProdutoConflito(null);
                  }}
                  className="w-full border border-line bg-field text-ink rounded-lg p-2.5 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                />

                {produtoConflito && (
                  <div className="p-3 rounded-lg border border-brand/40 bg-primary-soft/30 text-xs text-ink space-y-2">
                    <p>Já existe um produto com nome equivalente cadastrado: &quot;{produtoConflito.nome}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProdutoSelecionadoId(produtoConflito.id);
                        setProdutoConflito(null);
                        setMostrarFormProduto(false);
                      }}
                      className="font-semibold text-secondary hover:underline cursor-pointer flex items-center gap-1 min-h-[44px]"
                    >
                      Visualizar produto existente →
                    </button>
                  </div>
                )}

                <motion.button
                  type="submit"
                  whileTap={tap}
                  disabled={criandoProduto || !nomeNovoProduto.trim()}
                  className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary py-2.5 rounded-lg font-bold text-sm cursor-pointer min-h-[44px] shadow-sm"
                >
                  {criandoProduto ? 'Criando...' : 'Criar produto'}
                </motion.button>
              </form>
            </Sheet>

            {carregandoProdutos && produtos.length === 0 && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-2xl bg-field animate-pulse" />
                ))}
              </div>
            )}
            {!carregandoProdutos && produtos.length === 0 && !mostrarFormProduto && (
              <EstadoVazio
                titulo="Nenhum produto cadastrado"
                descricao="Crie os lanches do cardápio e monte a ficha técnica de cada um para o desconto automático de estoque."
              />
            )}
            {produtos.length > 0 && termo && produtosFiltrados.length === 0 && (
              <EstadoVazio titulo="Nenhum produto encontrado" descricao={`Nada corresponde a "${busca.trim()}".`} />
            )}
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {produtosFiltrados.map((prod) => (
                  <motion.div
                    key={prod.id}
                    variants={rise}
                    whileTap={tap}
                    onClick={() => setProdutoSelecionadoId(prod.id)}
                    className="bg-card border border-line rounded-3xl pl-3 pr-1 py-2 flex items-center gap-3 cursor-pointer hover:border-primary transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl bg-primary-soft text-brand flex items-center justify-center shrink-0">
                      <Hamburger size={22} weight="duotone" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink line-clamp-2 break-words">{prod.nome}</p>
                      <p className="text-xs text-muted">Ficha técnica</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deletarProduto(prod, e)}
                      className="text-faint hover:text-danger rounded-xl cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title={`Excluir ${prod.nome}`}
                      aria-label={`Excluir ${prod.nome}`}
                    >
                      <Trash size={17} />
                    </button>
                    <CaretRight size={18} className="text-faint shrink-0" />
                  </motion.div>
                ))}
            </motion.div>

            <div className="sticky bottom-20 pt-1 z-10">
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => setMostrarFormProduto(true)}
                className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold flex items-center justify-center gap-2 shadow-primary cursor-pointer"
              >
                <Plus size={20} weight="bold" /> Novo produto
              </motion.button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
