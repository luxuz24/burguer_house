import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import FichaTecnica from './FichaTecnica';
import PreparoInterno from './PreparoInterno';
import ImportarNotaFiscal from './ImportarNotaFiscal';
import { Plus, Edit2, Trash2, Package, AlertTriangle, ChefHat, FileText } from 'lucide-react';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
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
  estoqueAtual: number;
  estoqueMinimo: number;
  produzidoInternamente?: boolean;
  validadeDias?: number | '';
}

const formInsumoVazio: FormInsumo = { id: '', nome: '', unidade: 'Gramas', estoqueAtual: 0, estoqueMinimo: 0, produzidoInternamente: false, validadeDias: '' };

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

  const carregarInsumos = async () => {
    try {
      const res = await api.get('/insumos');
      setInsumos(res.data);
    } catch { console.error('Erro ao carregar insumos'); }
  };

  const carregarProdutos = async () => {
    try {
      const res = await api.get('/produtos');
      setProdutos(res.data);
    } catch { console.error('Erro ao carregar produtos'); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (abaAtiva === 'insumos') carregarInsumos();
      else carregarProdutos();
    }, 0);
    return () => clearTimeout(timer);
  }, [abaAtiva]);

  const salvarInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nome: formInsumo.nome,
        unidade: formInsumo.unidade,
        estoqueAtual: Number(formInsumo.estoqueAtual),
        estoqueMinimo: Number(formInsumo.estoqueMinimo),
        fatorPerda: 0,
        produzidoInternamente: formInsumo.produzidoInternamente,
        validadeDias: formInsumo.produzidoInternamente && formInsumo.validadeDias !== '' ? Number(formInsumo.validadeDias) : null
      };
      if (formInsumo.id) {
        await api.put(`/insumos/${formInsumo.id}`, payload);
      } else {
        await api.post('/insumos', payload);
      }
      setMostrarFormInsumo(false);
      setFormInsumo(formInsumoVazio);
      carregarInsumos();
    } catch {
      alert('Erro ao salvar insumo');
    }
  };

  const deletarInsumo = async (id: string) => {
    if (!confirm('Deseja realmente apagar este insumo?')) return;
    try {
      await api.delete(`/insumos/${id}`);
      carregarInsumos();
    } catch {
      alert('Falha ao deletar insumo.');
    }
  };

  const criarProduto = async () => {
    const nome = prompt("Nome do novo Produto (ex: X-Bacon):");
    if (!nome) return;
    try {
      await api.post('/produtos', { nome });
      carregarProdutos();
    } catch {
      alert("Erro ao criar produto");
    }
  };

  // Se um produto foi selecionado, renderiza a tela de Ficha Técnica (e passa prop para voltar)
  if (produtoSelecionadoId) {
    return <FichaTecnica produtoId={produtoSelecionadoId} onVoltar={() => setProdutoSelecionadoId(null)} />;
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
            onClick={() => setAbaAtiva('insumos')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${abaAtiva === 'insumos' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            Insumos Brutos
          </button>
          <button 
            type="button"
            onClick={() => setAbaAtiva('produtos')}
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
                  onClick={() => setMostrarFormInsumo(true)}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm cursor-pointer"
                >
                  <Plus size={20} /> Novo Insumo
                </button>
                <button 
                  type="button"
                  onClick={() => setMostrarImportarNota(true)}
                  className="bg-emerald-600 text-white rounded-xl px-4 py-3 font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-sm whitespace-nowrap cursor-pointer"
                  title="Importar XML de NF-e"
                >
                  <FileText size={18} /> Importar NF-e
                </button>
              </div>
            )}

            {/* Formulário Insumo */}
            {mostrarFormInsumo && (
              <form onSubmit={salvarInsumo} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">{formInsumo.id ? 'Editar Insumo' : 'Cadastrar Insumo'}</h3>
                
                <div className="flex gap-2">
                  <input required placeholder="Nome (ex: Maionese)" value={formInsumo.nome} onChange={e => setFormInsumo({...formInsumo, nome: e.target.value})} className="flex-1 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                  <select value={formInsumo.unidade} onChange={e => setFormInsumo({...formInsumo, unidade: e.target.value})} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white w-28">
                    <option value="Gramas">g</option>
                    <option value="Unidades">un</option>
                    <option value="Mililitros">ml</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400 ml-1">Estoque Atual</label>
                    <input type="number" required min="0" step="0.01" value={formInsumo.estoqueAtual} onChange={e => setFormInsumo({...formInsumo, estoqueAtual: Number(e.target.value)})} className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400 ml-1">Mínimo Seguro</label>
                    <input type="number" required min="0" step="0.01" value={formInsumo.estoqueMinimo} onChange={e => setFormInsumo({...formInsumo, estoqueMinimo: Number(e.target.value)})} className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 ml-1">
                  <input type="checkbox" checked={formInsumo.produzidoInternamente} onChange={e => setFormInsumo({...formInsumo, produzidoInternamente: e.target.checked})} />
                  Produzido na casa (item beneficiado)
                </label>
                {formInsumo.produzidoInternamente && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 ml-1">Validade (dias)</label>
                    <input type="number" min="1" step="1" value={formInsumo.validadeDias} onChange={e => setFormInsumo({...formInsumo, validadeDias: e.target.value === '' ? '' : Number(e.target.value)})} className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setMostrarFormInsumo(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg font-medium cursor-pointer">Cancelar</button>
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium cursor-pointer">Salvar</button>
                </div>
              </form>
            )}

            {/* Filtros de Insumos */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setFiltroInsumos('todos')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                  filtroInsumos === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todos ({insumos.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroInsumos('beneficiados')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  filtroInsumos === 'beneficiados' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <ChefHat size={14} /> Preparo Interno ({insumos.filter(i => i.produzidoInternamente).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroInsumos('alertas')}
                className={`px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap flex items-center gap-1 ${
                  filtroInsumos === 'alertas' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <AlertTriangle size={14} /> Alertas ({insumos.filter(i => {
                  const val = calcularValidade(i);
                  return i.estoqueAtual <= i.estoqueMinimo || (val ? val.vencido || val.alerta : false);
                }).length})
              </button>
            </div>

            {/* Lista Insumos Cards */}
            <div className="space-y-3">
              {insumos
                .filter(insumo => {
                  if (filtroInsumos === 'beneficiados') return !!insumo.produzidoInternamente;
                  if (filtroInsumos === 'alertas') {
                    const isAbaixo = insumo.estoqueAtual <= insumo.estoqueMinimo;
                    const val = calcularValidade(insumo);
                    return isAbaixo || (val ? val.vencido || val.alerta : false);
                  }
                  return true;
                })
                .map(insumo => {
                  const isCritico = insumo.estoqueAtual <= insumo.estoqueMinimo;
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
                              <AlertTriangle size={12}/> Abaixo do mínimo ({insumo.estoqueMinimo})
                            </p>
                          )}

                          {val?.vencido && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={12} /> Vencido há {Math.abs(val.diasRestantes)} dia(s)!
                            </p>
                          )}

                          {val?.alerta && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={12} /> Perto de vencer ({val.diasRestantes} dia(s) restante(s))
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
                              className="bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold cursor-pointer"
                            >
                              <ChefHat size={15} /> Produzir
                            </button>
                          )}
                          <button type="button" onClick={() => { setFormInsumo({ ...insumo, validadeDias: insumo.validadeDias ?? '' }); setMostrarFormInsumo(true); }} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 p-2 rounded-lg cursor-pointer"><Edit2 size={18} /></button>
                          <button type="button" onClick={() => deletarInsumo(insumo.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-gray-800 p-2 rounded-lg cursor-pointer"><Trash2 size={18} /></button>
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
            <button 
              type="button"
              onClick={criarProduto}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 hover:bg-blue-700 shadow-sm cursor-pointer"
            >
              <Plus size={20} /> Novo Produto
            </button>

            <div className="grid grid-cols-2 gap-3">
              {produtos.map(prod => (
                <button 
                  key={prod.id} 
                  type="button"
                  onClick={() => setProdutoSelecionadoId(prod.id)}
                  className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm text-left hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center gap-2 h-28 cursor-pointer"
                >
                  <Package size={28} className="text-gray-400" />
                  <span className="font-semibold text-gray-900 dark:text-white text-center text-sm">{prod.nome}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
