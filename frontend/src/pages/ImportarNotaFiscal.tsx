import { useState, useEffect } from 'react';
import { ArrowLeft, Upload, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { api } from '../lib/api';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
}

interface ItemNFeExtraido {
  itemNumero: number;
  codigo: string;
  descricao: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  valorTotal: number;
  sugestaoInsumoId: string | null;
  sugestaoInsumoNome: string | null;
  sugestaoUnidadeInsumo: string | null;
  fatorConversaoSugerido: number;
  quantidadeConvertidaSugerida: number;
}

interface NFeParseada {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  fornecedor: {
    nome: string;
    cnpjCpf: string;
  };
  valorTotal: number;
  itens: ItemNFeExtraido[];
}

interface ItemMapeado {
  itemNumero: number;
  descricao: string;
  unidadeOriginal: string;
  quantidadeOriginal: number;
  valorUnitario: number;
  incluir: boolean;
  insumoId: string;
  fatorConversao: number;
}

interface InsumoAtualizado {
  id: string;
  nome: string;
  adicionado: number;
  novoEstoque: number;
}

interface ResultadoConfirmacao {
  message: string;
  totalItensProcessados: number;
  insumosAtualizados: InsumoAtualizado[];
}

interface Props {
  onVoltar: () => void;
}

export default function ImportarNotaFiscal({ onVoltar }: Props) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState<NFeParseada | null>(null);
  const [itensMapeados, setItensMapeados] = useState<ItemMapeado[]>([]);
  const [sucesso, setSucesso] = useState(false);
  const [resultadoConfirmacao, setResultadoConfirmacao] = useState<ResultadoConfirmacao | null>(null);

  useEffect(() => {
    api.get('/insumos')
      .then((res) => setInsumos(res.data))
      .catch(() => console.error('Erro ao carregar insumos'));
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      alert('Por favor, selecione um arquivo no formato .xml de NF-e');
      return;
    }

    try {
      setProcessando(true);
      const xml = await file.text();
      const res = await api.post('/notas-fiscais/parser-xml', { xml });
      const data: NFeParseada = res.data;

      setNota(data);
      // Inicializa mapeamento com sugestões automáticas
      const mapeamentoInicial: ItemMapeado[] = data.itens.map((it) => ({
        itemNumero: it.itemNumero,
        descricao: it.descricao,
        unidadeOriginal: it.unidadeOriginal,
        quantidadeOriginal: it.quantidadeOriginal,
        valorUnitario: it.valorUnitario,
        incluir: !!it.sugestaoInsumoId,
        insumoId: it.sugestaoInsumoId || '',
        fatorConversao: it.fatorConversaoSugerido || 1,
      }));
      setItensMapeados(mapeamentoInicial);
    } catch (error: unknown) {
      let msg = 'Erro ao processar o arquivo XML da nota fiscal';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        msg = error.response.data.message;
      }
      alert(msg);
    } finally {
      setProcessando(false);
    }
  };

  const atualizarItem = <K extends keyof ItemMapeado>(itemNumero: number, campo: K, valor: ItemMapeado[K]) => {
    setItensMapeados((prev) =>
      prev.map((it) => {
        if (it.itemNumero !== itemNumero) return it;
        const atualizado = { ...it, [campo]: valor };

        // Se trocou de insumo, recalcula sugestão de conversão automática se possível
        if (campo === 'insumoId' && typeof valor === 'string') {
          const insumoEscolhido = insumos.find((i) => i.id === valor);
          if (insumoEscolhido) {
            const uNota = it.unidadeOriginal.toUpperCase();
            const uIns = insumoEscolhido.unidade.toUpperCase();
            if ((uNota === 'KG' || uNota === 'KILO') && uIns === 'GRAMAS') {
              atualizado.fatorConversao = 1000;
            } else if ((uNota === 'L' || uNota === 'LT') && uIns === 'MILILITROS') {
              atualizado.fatorConversao = 1000;
            } else {
              atualizado.fatorConversao = 1;
            }
          }
        }
        return atualizado;
      })
    );
  };

  const confirmarEntrada = async () => {
    const itensParaSalvar = itensMapeados
      .filter((it) => it.incluir && it.insumoId && (it.quantidadeOriginal * it.fatorConversao) > 0)
      .map((it) => ({
        insumoId: it.insumoId,
        quantidade: it.quantidadeOriginal * it.fatorConversao,
        valorUnitario: it.valorUnitario / (it.fatorConversao || 1),
        descricaoOriginal: it.descricao,
        unidadeOriginal: it.unidadeOriginal,
        quantidadeOriginal: it.quantidadeOriginal,
        valorTotal: it.quantidadeOriginal * it.valorUnitario,
      }));

    if (itensParaSalvar.length === 0) {
      alert('Selecione e vincule ao menos um item da nota fiscal para entrada de estoque.');
      return;
    }

    try {
      setSalvando(true);
      const res = await api.post('/notas-fiscais/confirmar', {
        chaveAcesso: nota?.chaveAcesso,
        numero: nota?.numero,
        serie: nota?.serie,
        fornecedorNome: nota?.fornecedor.nome,
        fornecedorCnpj: nota?.fornecedor.cnpjCpf,
        valorTotal: nota?.valorTotal,
        dataEmissao: nota?.dataEmissao,
        itens: itensParaSalvar,
      });
      setResultadoConfirmacao(res.data);
      setSucesso(true);
    } catch (error: unknown) {
      let msg = 'Erro ao confirmar entrada de estoque';
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        msg = error.response.data.message;
      }
      alert(msg);
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="flex flex-col min-h-full pb-20 bg-gray-50">
        <div className="bg-white p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Entrada Confirmada</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Estoque Atualizado com Sucesso!</h2>
          <p className="text-sm text-gray-600 max-w-xs">
            Foram atualizados {resultadoConfirmacao?.totalItensProcessados || 0} insumos no almoxarifado a partir da NF-e.
          </p>

          <div className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left space-y-2 mt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Itens Incrementados:</h3>
            {resultadoConfirmacao?.insumosAtualizados?.map((ins) => (
              <div key={ins.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="font-medium text-gray-800">{ins.nome}</span>
                <span className="text-green-600 font-bold">+{ins.adicionado}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onVoltar}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Voltar para o Estoque
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 border-b border-gray-200 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onVoltar} className="text-gray-600 p-1 hover:bg-gray-100 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Entrada por Nota Fiscal</h1>
          <p className="text-xs text-gray-500">Upload e leitura de XML de NF-e</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Upload Zone */}
        {!nota && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center text-center space-y-3 hover:border-blue-500 transition-colors">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Upload size={28} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-base">Selecione o arquivo XML da NF-e</p>
              <p className="text-xs text-gray-500 mt-1">Arquivos no formato .xml emitidos pela SEFAZ</p>
            </div>
            <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-6 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors">
              {processando ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} /> Lendo XML...
                </span>
              ) : (
                'Procurar Arquivo'
              )}
              <input type="file" accept=".xml" onChange={handleFileUpload} disabled={processando} className="hidden" />
            </label>
          </div>
        )}

        {/* Resumo da Nota Parseada */}
        {nota && (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    NF-e nº {nota.numero || 'S/N'}
                  </span>
                  <h2 className="font-bold text-gray-900 text-base mt-1">{nota.fornecedor.nome}</h2>
                  {nota.fornecedor.cnpjCpf && (
                    <p className="text-xs text-gray-500">CNPJ: {nota.fornecedor.cnpjCpf}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Valor Total</p>
                  <p className="font-bold text-gray-900 text-base">
                    R$ {Number(nota.valorTotal || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                <span>{nota.itens.length} itens encontrados na nota</span>
                <label className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1 font-medium">
                  <RefreshCw size={12} /> Trocar XML
                  <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Lista de Itens para Mapeamento */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                Conferência e Vínculo de Insumos
              </h3>

              {itensMapeados.map((item) => {
                const insumoSelecionado = insumos.find((i) => i.id === item.insumoId);
                const qtdConvertida = item.quantidadeOriginal * item.fatorConversao;

                return (
                  <div
                    key={item.itemNumero}
                    className={`bg-white rounded-xl border p-4 shadow-sm transition-colors space-y-3 ${
                      item.incluir ? 'border-gray-200' : 'border-gray-200 opacity-60 bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={item.incluir}
                          onChange={(e) => atualizarItem(item.itemNumero, 'incluir', e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 text-sm leading-snug">{item.descricao}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Nota: <strong>{item.quantidadeOriginal} {item.unidadeOriginal}</strong> • R$ {item.valorUnitario.toFixed(2)}/{item.unidadeOriginal}
                          </p>
                        </div>
                      </div>
                    </div>

                    {item.incluir && (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2 text-xs">
                        <div>
                          <label className="font-semibold text-gray-700 block mb-1">
                            Vincular ao Insumo do Almoxarifado:
                          </label>
                          <select
                            value={item.insumoId}
                            onChange={(e) => atualizarItem(item.itemNumero, 'insumoId', e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 bg-white text-sm"
                          >
                            <option value="">Selecione o insumo...</option>
                            {insumos.map((ins) => (
                              <option key={ins.id} value={ins.id}>
                                {ins.nome} ({ins.unidade}) - Estoque atual: {ins.estoqueAtual}
                              </option>
                            ))}
                          </select>
                        </div>

                        {insumoSelecionado && (
                          <div className="flex gap-2 items-center pt-1">
                            <div className="flex-1">
                              <label className="text-gray-500 text-[11px] block">Fator de Conversão</label>
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={item.fatorConversao}
                                onChange={(e) =>
                                  atualizarItem(item.itemNumero, 'fatorConversao', Number(e.target.value) || 1)
                                }
                                className="w-full p-1.5 rounded border border-gray-300 bg-white text-sm"
                              />
                            </div>
                            <div className="flex-1 text-right">
                              <span className="text-[11px] text-gray-500 block">Entrada no Estoque:</span>
                              <span className="text-sm font-bold text-green-700">
                                +{qtdConvertida.toFixed(2)} {insumoSelecionado.unidade}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ações */}
            <div className="pt-2">
              <button
                onClick={confirmarEntrada}
                disabled={salvando}
                className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm disabled:opacity-50"
              >
                {salvando ? (
                  <>
                    <Loader2 className="animate-spin" size={20} /> Confirmando Entrada...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} /> Confirmar Entrada no Estoque
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
