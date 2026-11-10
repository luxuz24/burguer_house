import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useEnvio } from '../hooks/useEnvio';
import { stagger, rise, tap } from '../lib/motion';
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
    if (!nome) {
      toast.erro('O nome do produto é obrigatório.');
      return;
    }
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
    if (filtroInsumos === 'alertas') return temAlerta(insumo);
    return true;
  });

  const totalAlertas = insumos.filter(temAlerta).length;

  // Se um produto foi selecionado, renderiza a tela de Ficha Técnica (e passa prop para voltar)
  if (produtoSelecionadoId) {
    return (
      <FichaTecnica
        produtoId={produtoSelecionadoId}
        onVoltar={() => {
          setProdutoSelecionadoId(null);
          carregarProdutos();
        }}
        onSelecionarProduto={(id) => setProdutoSelecionadoId(id)}
      />
    );
  }

  if (beneficiadoSelecionadoId) {
    return <PreparoInterno insumoId={beneficiadoSelecionadoId} onVoltar={() => { setBeneficiadoSelecionadoId(null); carregarInsumos(); }} />;
  }

  if (mostrarImportarNota) {
    return <ImportarNotaFiscal onVoltar={() => { setMostrarImportarNota(false); carregarInsumos(); }} />;
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink transition-colors">
      
      {/* Abas no topo */}
      <div className="bg-card px-4 pt-4 border-b border-line sticky top-0 z-10 transition-colors">
        <h1 className="text-xl font-bold text-ink mb-4">Gestão de Estoque</h1>
        
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={() => {
              setAbaAtiva('insumos');
              setCarregandoInsumos(true);
            }}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              abaAtiva === 'insumos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            Insumos Brutos
          </button>
          <button 
            type="button"
            onClick={() => {
              setAbaAtiva('produtos');
              setCarregandoProdutos(true);
            }}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              abaAtiva === 'produtos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-ink'
            }`}
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
                <motion.button 
                  type="button"
                  whileTap={tap}
                  onClick={() => { setFormInsumo(formInsumoVazio); setMostrarFormInsumo(true); }}
                  className="flex-1 bg-primary text-on-primary rounded-xl py-3 font-semibold flex items-center justify-center gap-2 shadow-primary cursor-pointer min-h-[44px]"
                >
                  <Plus size={20} weight="bold" /> Novo Insumo
                </motion.button>
                <motion.button 
                  type="button"
                  whileTap={tap}
                  onClick={() => setMostrarImportarNota(true)}
                  className="bg-card-2 border border-line text-ink rounded-xl px-4 py-3 font-semibold flex items-center justify-center gap-2 hover:bg-field shadow-sm whitespace-nowrap cursor-pointer min-h-[44px]"
                  title="Importar XML de NF-e"
                >
                  <FileText size={18} weight="duotone" className="text-secondary" /> Importar NF-e
                </motion.button>
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
                className="bg-card p-4 rounded-xl border border-line shadow-sm space-y-3"
              >
                <h3 className="font-semibold text-ink">{formInsumo.id ? 'Editar Insumo' : 'Cadastrar Insumo'}</h3>
                
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
            )}

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
                    ? 'bg-danger text-white font-bold shadow-sm'
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
                                <span className="inline-flex bg-secondary-soft text-secondary text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  Beneficiado
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted mt-1">
                            Estoque:{' '}
                            <span className={`font-bold ${isCritico ? 'text-danger' : 'text-ink'}`}>
                              {insumo.estoqueAtual} {insumo.unidade}
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
                    </motion.div>
                  );
                })}
              </motion.div>
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
                className="bg-card p-4 rounded-xl border border-line shadow-sm space-y-3"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-ink">Novo Produto</h3>
                  <button
                    type="button"
                    onClick={() => { setMostrarFormProduto(false); setNomeNovoProduto(''); setProdutoConflito(null); }}
                    className="text-muted hover:text-ink cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
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
            ) : (
              <motion.button 
                type="button"
                whileTap={tap}
                onClick={() => setMostrarFormProduto(true)}
                className="w-full bg-primary text-on-primary rounded-xl py-3 font-semibold flex items-center justify-center gap-2 shadow-primary cursor-pointer min-h-[44px]"
              >
                <Plus size={20} weight="bold" /> Novo Produto
              </motion.button>
            )}

            {carregandoProdutos && produtos.length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-field animate-pulse" />
                ))}
              </div>
            )}

            {!carregandoProdutos && produtos.length === 0 && !mostrarFormProduto && (
              <EstadoVazio
                titulo="Nenhum produto cadastrado"
                descricao="Crie os lanches do cardápio e monte a ficha técnica de cada um para o desconto automático de estoque."
              />
            )}

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3"
            >
              {produtos.map(prod => (
                <motion.div
                  key={prod.id}
                  variants={rise}
                  whileHover={{ y: -2 }}
                  whileTap={tap}
                  onClick={() => setProdutoSelecionadoId(prod.id)}
                  className="bg-card p-4 rounded-xl border border-line shadow-sm text-left hover:border-primary transition-colors flex flex-col items-center justify-center gap-2 h-28 cursor-pointer relative group"
                >
                  <button
                    type="button"
                    onClick={(e) => deletarProduto(prod, e)}
                    className="absolute top-2 right-2 p-1.5 text-faint hover:text-danger hover:bg-danger-soft/30 rounded-lg transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title={`Excluir ${prod.nome}`}
                    aria-label={`Excluir ${prod.nome}`}
                  >
                    <Trash size={15} weight="duotone" />
                  </button>
                  <Package size={28} weight="duotone" className="text-muted" />
                  <span className="font-semibold text-ink text-center text-sm px-2 line-clamp-2">{prod.nome}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </div>

    </div>
  );
}
