import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import EstadoVazio from '../components/EstadoVazio';
import FichaTecnica from './FichaTecnica';
import PreparoInterno from './PreparoInterno';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import { Plus, PencilSimple, Trash, Package, Warning, ChefHat, FileText, X } from '../components/ui/icons';

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

export default function Estoque() {
  const [abaAtiva, setAbaAtiva] = useState<'insumos' | 'produtos'>('insumos');
  
  // Estados para Insumos
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [mostrarFormInsumo, setMostrarFormInsumo] = useState(false);
  const [formInsumo, setFormInsumo] = useState<FormInsumo>(formInsumoVazio);
  const [beneficiadoSelecionadoId, setBeneficiadoSelecionadoId] = useState<string | null>(null);
  const [filtroInsumos, setFiltroInsumos] = useState<'todos' | 'beneficiados' | 'alertas'>('todos');
  const [mostrarImportarNota, setMostrarImportarNota] = useState(false);

  // Estados para Produtos
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string | null>(null);
  const [mostrarFormProduto, setMostrarFormProduto] = useState(false);
  const [nomeNovoProduto, setNomeNovoProduto] = useState('');
  const [produtoConflito, setProdutoConflito] = useState<{ id: string; nome: string } | null>(null);

  const [carregandoInsumos, setCarregandoInsumos] = useState(true);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const abaAtivaRef = useRef(abaAtiva);

  const { toast, confirmar } = useFeedback();

  const carregarInsumos = useCallback(async () => {
    setCarregandoInsumos(true);
    try {
      const res = await api.get('/insumos');
      if (abaAtivaRef.current === 'insumos') {
        setInsumos(res.data);
      }
    } catch (error) {
      if (abaAtivaRef.current === 'insumos') {
        toast.erro(mensagemDeErro(error, 'Erro ao carregar insumos.'));
      }
    } finally {
      if (abaAtivaRef.current === 'insumos') {
        setCarregandoInsumos(false);
      }
    }
  }, [toast]);

  const carregarProdutos = useCallback(async () => {
    setCarregandoProdutos(true);
    try {
      const res = await api.get('/produtos');
      if (abaAtivaRef.current === 'produtos') {
        setProdutos(res.data);
      }
    } catch (error) {
      if (abaAtivaRef.current === 'produtos') {
        toast.erro(mensagemDeErro(error, 'Erro ao carregar produtos.'));
      }
    } finally {
      if (abaAtivaRef.current === 'produtos') {
        setCarregandoProdutos(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    abaAtivaRef.current = abaAtiva;
    let ativo = true;

    if (abaAtiva === 'insumos') {
      api.get('/insumos')
        .then((res) => {
          if (!ativo) return;
          setInsumos(res.data);
        })
        .catch((error) => {
          if (!ativo) return;
          toast.erro(mensagemDeErro(error, 'Erro ao carregar insumos.'));
        })
        .finally(() => {
          if (!ativo) return;
          setCarregandoInsumos(false);
        });
    } else {
      api.get('/produtos')
        .then((res) => {
          if (!ativo) return;
          setProdutos(res.data);
        })
        .catch((error) => {
          if (!ativo) return;
          toast.erro(mensagemDeErro(error, 'Erro ao carregar produtos.'));
        })
        .finally(() => {
          if (!ativo) return;
          setCarregandoProdutos(false);
        });
    }

    return () => {
      ativo = false;
    };
  }, [abaAtiva, toast]);

  const { enviando: salvandoInsumo, executar: executarSalvarInsumo } = useEnvio(async () => {
    if (formInsumo.fatorPerdaPct !== '') {
      const pct = Number(formInsumo.fatorPerdaPct);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        toast.erro('Fator de perda deve estar entre 0% e 100%.');
        return;
      }
    }

    const editando = !!formInsumo.id;
    const basePayload = {
      nome: formInsumo.nome.trim(),
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
      await carregarInsumos();
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
      await carregarInsumos();
      toast.sucesso(`"${insumo.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Falha ao apagar insumo (pode estar em uso em uma ficha técnica).'));
    }
  };

  const { enviando: criandoProduto, executar: executarCriarProduto } = useEnvio(async () => {
    const nome = nomeNovoProduto.trim();
    if (!nome) return;
    try {
      const res = await api.post('/produtos', { nome });
      setNomeNovoProduto('');
      setMostrarFormProduto(false);
      setProdutoConflito(null);
      await carregarProdutos();
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
      await carregarProdutos();
      toast.sucesso(`Produto "${prod.nome}" removido.`);
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao apagar produto.'));
    }
  };

  const insumosFiltrados = insumos.filter((insumo) => {
    if (filtroInsumos === 'beneficiados') return !!insumo.produzidoInternamente;
    if (filtroInsumos === 'alertas') {
      const val = calcularValidade(insumo);
      const estoqueCritico = insumo.estoqueMinimo > 0
        ? insumo.estoqueAtual <= insumo.estoqueMinimo
        : insumo.estoqueAtual <= 0;
      return estoqueCritico || (val ? val.vencido || val.alerta : false);
    }
    return true;
  });

  const totalAlertas = insumos.filter((i) => {
    const val = calcularValidade(i);
    const estoqueCritico = i.estoqueMinimo > 0
      ? i.estoqueAtual <= i.estoqueMinimo
      : i.estoqueAtual <= 0;
    return estoqueCritico || (val ? val.vencido || val.alerta : false);
  }).length;

  // Se um produto foi selecionado, renderiza a tela de Ficha Técnica (e passa prop para voltar)
  if (produtoSelecionadoId) {
    return <FichaTecnica produtoId={produtoSelecionadoId} onVoltar={() => { setProdutoSelecionadoId(null); carregarProdutos(); }} />;
  }

  if (beneficiadoSelecionadoId) {
    return <PreparoInterno insumoId={beneficiadoSelecionadoId} onVoltar={() => { setBeneficiadoSelecionadoId(null); carregarInsumos(); }} />;
  }

  if (mostrarImportarNota) {
    return <ImportarNotaFiscal onVoltar={() => { setMostrarImportarNota(false); carregarInsumos(); }} />;
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* Abas no topo */}
      <div className="bg-white dark:bg-gray-900 px-4 pt-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-colors">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Gestão de Estoque</h1>
        
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={() => {
              setAbaAtiva('insumos');
              setCarregandoInsumos(true);
            }}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${abaAtiva === 'insumos' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Insumos Brutos
          </button>
          <button 
            type="button"
            onClick={() => {
              setAbaAtiva('produtos');
              setCarregandoProdutos(true);
            }}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${abaAtiva === 'produtos' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Produtos Prontos
          </button>
        </div>
      </div>

      <div className="p-4">
        {abaAtiva === 'insumos' && (
          <div className="space-y-4">
            {/* Botões de Ação de Insumo */}
            {!mostrarFormInsumo && (
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => { setFormInsumo(formInsumoVazio); setMostrarFormInsumo(true); }}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm cursor-pointer min-h-[44px]"
                >
                  <Plus size={20} /> Novo Insumo
                </button>
                <button 
                  type="button"
                  onClick={() => setMostrarImportarNota(true)}
                  className="bg-emerald-600 text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-sm whitespace-nowrap cursor-pointer min-h-[44px]"
                  title="Importar XML de NF-e"
                >
                  <FileText size={18} /> Importar NF-e
                </button>
              </div>
            )}

            {/* Formulário Insumo */}
            {mostrarFormInsumo && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void executarSalvarInsumo();
                }}
                className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3"
              >
                <h3 className="font-semibold text-gray-800 dark:text-white">{formInsumo.id ? 'Editar Insumo' : 'Cadastrar Insumo'}</h3>
                
                <div className="flex gap-2">
                  <input
                    required
                    aria-label="Nome do insumo"
                    placeholder="Nome (ex: Maionese)"
                    value={formInsumo.nome}
                    onChange={e => setFormInsumo({...formInsumo, nome: e.target.value})}
                    className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
                  />
                  <select
                    aria-label="Unidade de medida"
                    value={formInsumo.unidade}
                    onChange={e => setFormInsumo({...formInsumo, unidade: e.target.value})}
                    className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white w-28 min-h-[44px]"
                  >
                    <option value="Gramas">g</option>
                    <option value="Unidades">un</option>
                    <option value="Mililitros">ml</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="estoque-atual-input" className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                      Estoque Atual {formInsumo.id && <span className="text-[10px] text-gray-400">(ajustado por movimentações)</span>}
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
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="estoque-minimo-input" className="text-xs text-gray-500 dark:text-gray-400 ml-1">Mínimo Seguro</label>
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
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label htmlFor="custo-unitario-input" className="text-xs text-gray-500 dark:text-gray-400 ml-1">Custo Unit. (R$)</label>
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
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px]"
                    />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="fator-perda-input" className="text-xs text-gray-500 dark:text-gray-400 ml-1">Fator Perda (%)</label>
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
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 min-h-[44px]"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ml-1 min-h-[44px] cursor-pointer">
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
                    <label htmlFor="validade-dias-input" className="text-xs text-gray-500 dark:text-gray-400 ml-1">Validade (dias)</label>
                    <input
                      id="validade-dias-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      aria-label="Validade em dias"
                      value={formInsumo.validadeDias}
                      onChange={e => setFormInsumo({...formInsumo, validadeDias: e.target.value === '' ? '' : Number(e.target.value)})}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white min-h-[44px]"
                    />
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarFormInsumo(false)}
                    className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg font-medium cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoInsumo}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-lg font-medium cursor-pointer min-h-[44px]"
                  >
                    {salvandoInsumo ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}

            {/* Filtros de Insumos */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setFiltroInsumos('todos')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap min-h-[44px] flex items-center ${
                  filtroInsumos === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                Todos ({insumos.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroInsumos('beneficiados')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                  filtroInsumos === 'beneficiados' ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <ChefHat size={14} /> Preparo Interno ({insumos.filter(i => i.produzidoInternamente).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroInsumos('alertas')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap flex items-center gap-1 min-h-[44px] ${
                  filtroInsumos === 'alertas' ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <Warning size={14} /> Alertas ({totalAlertas})
              </button>
            </div>

            {/* Lista Insumos Cards */}
            <div className="space-y-3">
              {carregandoInsumos && insumos.length === 0 && (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
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

              {insumos.length > 0 && filtroInsumos === 'alertas' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Tudo em ordem por aqui"
                  descricao="Nenhum insumo abaixo do mínimo ou perto de vencer."
                />
              )}

              {insumos.length > 0 && filtroInsumos === 'beneficiados' && insumosFiltrados.length === 0 && (
                <EstadoVazio
                  titulo="Nenhum item de preparo interno"
                  descricao='Marque "Produzido internamente" ao cadastrar um insumo (ex.: maionese da casa) para controlar produção e validade.'
                />
              )}

              {insumosFiltrados
                .map(insumo => {
                  const isCritico = insumo.estoqueMinimo > 0
                    ? insumo.estoqueAtual <= insumo.estoqueMinimo
                    : insumo.estoqueAtual <= 0;
                  const val = calcularValidade(insumo);

                  return (
                    <div
                      key={insumo.id}
                      className={`bg-white dark:bg-gray-900 rounded-xl border p-4 shadow-sm relative overflow-hidden transition-colors ${
                        val?.vencido
                          ? 'border-red-400 bg-red-50/20 dark:bg-red-950/20'
                          : isCritico || val?.alerta
                          ? 'border-amber-300 dark:border-amber-700/60'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      {isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}
                      {val?.vencido && !isCritico && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-600"></div>}
                      {val?.alerta && !isCritico && !val.vencido && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>}
                      
                      <div className="flex justify-between items-start pl-2">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{insumo.nome}</h3>
                            {insumo.produzidoInternamente && (
                              <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Beneficiado
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Estoque:{' '}
                            <span className={`font-bold ${isCritico ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {insumo.estoqueAtual} {insumo.unidade}
                            </span>
                          </p>

                          {isCritico && (
                            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-1 font-medium">
                              <Warning size={12}/> {insumo.estoqueAtual <= 0 ? 'Sem estoque' : `Abaixo do mínimo (${insumo.estoqueMinimo})`}
                            </p>
                          )}

                          {val?.vencido && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-0.5 flex items-center gap-1">
                              <Warning size={12} /> Vencido há {Math.abs(val.diasRestantes)} dia(s)!
                            </p>
                          )}

                          {val?.alerta && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5 flex items-center gap-1">
                              <Warning size={12} /> Perto de vencer ({val.diasRestantes} dia(s) restante(s))
                            </p>
                          )}

                          {val && !val.vencido && !val.alerta && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 flex items-center gap-1 font-medium">
                              ✓ Válido por mais {val.diasRestantes} dia(s)
                            </p>
                          )}

                          {insumo.produzidoInternamente && !val && insumo.validadeDias && (
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 flex items-center gap-1">
                              <ChefHat size={12}/> Produzido na casa • validade {insumo.validadeDias}d
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1 items-center">
                          {insumo.produzidoInternamente && (
                            <button
                              type="button"
                              onClick={() => setBeneficiadoSelecionadoId(insumo.id)}
                              title="Produzir ou configurar sub-ficha"
                              aria-label={`Produzir ${insumo.nome}`}
                              className="bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer min-h-[44px]"
                            >
                              <ChefHat size={15} /> Produzir
                            </button>
                          )}
                          <button
                            type="button"
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
                            className="text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 p-2 rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Excluir ${insumo.nome}`}
                            onClick={() => deletarInsumo(insumo)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-gray-800 p-2 rounded-lg cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                          >
                            <Trash size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {abaAtiva === 'produtos' && (
          <div className="space-y-4">
            {mostrarFormProduto ? (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void executarCriarProduto();
                }}
                className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Novo Produto</h3>
                  <button
                    type="button"
                    onClick={() => { setMostrarFormProduto(false); setNomeNovoProduto(''); setProdutoConflito(null); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Cancelar"
                  >
                    <X size={18} />
                  </button>
                </div>
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
                  className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-2.5 text-sm min-h-[44px]"
                />

                {produtoConflito && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/60 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                    <p>Já existe um produto com nome equivalente cadastrado: &quot;{produtoConflito.nome}&quot;.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProdutoSelecionadoId(produtoConflito.id);
                        setProdutoConflito(null);
                        setMostrarFormProduto(false);
                      }}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 min-h-[44px]"
                    >
                      Visualizar produto existente →
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={criandoProduto || !nomeNovoProduto.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm cursor-pointer min-h-[44px]"
                >
                  {criandoProduto ? 'Criando...' : 'Criar produto'}
                </button>
              </form>
            ) : (
              <button 
                type="button"
                onClick={() => setMostrarFormProduto(true)}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm cursor-pointer min-h-[44px]"
              >
                <Plus size={20} /> Novo Produto
              </button>
            )}

            {carregandoProdutos && produtos.length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-gray-200/70 dark:bg-gray-800/70 animate-pulse" />
                ))}
              </div>
            )}

            {!carregandoProdutos && produtos.length === 0 && !mostrarFormProduto && (
              <EstadoVazio
                titulo="Nenhum produto cadastrado"
                descricao="Crie os lanches do cardápio e monte a ficha técnica de cada um para o desconto automático de estoque."
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {produtos.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => setProdutoSelecionadoId(prod.id)}
                  className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm text-left hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center gap-2 h-28 cursor-pointer relative group"
                >
                  <button
                    type="button"
                    onClick={(e) => deletarProduto(prod, e)}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title={`Excluir ${prod.nome}`}
                    aria-label={`Excluir ${prod.nome}`}
                  >
                    <Trash size={15} />
                  </button>
                  <Package size={28} className="text-gray-400" />
                  <span className="font-semibold text-gray-900 dark:text-white text-center text-sm px-2 line-clamp-2">{prod.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
