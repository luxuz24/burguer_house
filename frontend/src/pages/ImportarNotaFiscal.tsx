import Smash from '../components/brand/Smash';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, UploadSimple, QrCode, Camera, CheckCircle, CircleNotch, ArrowsClockwise, Sparkle, Question, WarningCircle, Plus, Trash } from '../components/ui/icons';
import { Html5Qrcode } from 'html5-qrcode';
import { api, mensagemDeErro } from '../lib/api';
import { formatarMoeda, formatarQuantidade } from '../lib/formatar';
import { useFeedback } from '../context/FeedbackContext';
import { sugerirConversao } from '../lib/unidades';
import { tocarBipScanner } from '../lib/bipScanner';
import { decodificarQrDeArquivo } from '../lib/qrImagem';
import { mapearItensIniciais, montarItensParaSalvar, type ItemMapeado, type NFeParseada } from '../lib/notaFiscal';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
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

const PASSOS = ['Ler', 'Revisar', 'Pronto'];

/** Indicador dos 3 passos da entrada por nota (telas.html#nf1, #nf2 e #nf3). */
function Passos({ atual }: { atual: number }) {
  return (
    <ol className="flex gap-1.5" aria-label="Passos da entrada por nota">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex-1" aria-current={i === atual ? 'step' : undefined}>
          <div className={`h-1 rounded-full ${i <= atual ? 'bg-primary' : 'bg-line'}`} />
          <p className={`text-[11px] font-semibold mt-1 ${i === atual ? 'text-brand' : 'text-muted'}`}>
            {i + 1}. {p}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function ImportarNotaFiscal({ onVoltar }: Props) {
  const { toast } = useFeedback();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nota, setNota] = useState<NFeParseada | null>(null);
  const [itensMapeados, setItensMapeados] = useState<ItemMapeado[]>([]);
  const [sucesso, setSucesso] = useState(false);
  const [resultadoConfirmacao, setResultadoConfirmacao] = useState<ResultadoConfirmacao | null>(null);

  // Estados do Scanner QR Code
  const [modoEntrada, setModoEntrada] = useState<'xml' | 'qrcode'>('xml');
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [chaveManual, setChaveManual] = useState('');
  const [mensagemFallback, setMensagemFallback] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputFotoQrRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.get('/insumos')
      .then((res) => setInsumos(res.data))
      .catch(() => console.error('Erro ao carregar insumos'));
  }, []);

  const handleFotoQrCode = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setProcessando(true);
      const textoQr = await decodificarQrDeArquivo(file);
      tocarBipScanner();
      await processarQrCode(textoQr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível ler o QR Code da imagem.';
      toast.aviso(msg);
      setProcessando(false);
    }
  };

  const iniciarCamera = async () => {
    const suportaStreamAoVivo =
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia;

    // Em HTTP na rede local (ex.: http://10.x.x.x:5173), o navegador mobile bloqueia getUserMedia,
    // mas permite abrir a câmera nativa via input capture="environment".
    if (!suportaStreamAoVivo) {
      inputFotoQrRef.current?.click();
      return;
    }

    try {
      setCameraAtiva(true);
      setTimeout(async () => {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        const configScanner = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScanSuccess = (decodedText: string) => {
          tocarBipScanner();
          pararCamera();
          processarQrCode(decodedText);
        };

        try {
          await scanner.start({ facingMode: 'environment' }, configScanner, onScanSuccess, () => {});
        } catch {
          // Fallback para Firefox Mobile / aparelhos com múltiplas lentes traseiras
          try {
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
              throw new Error('Nenhuma câmera encontrada');
            }
            const cameraTraseira =
              cameras.find((c) => /back|traseira|rear|environment|0/i.test(c.label)) ??
              cameras[cameras.length - 1]!;
            await scanner.start(cameraTraseira.id, configScanner, onScanSuccess, () => {});
          } catch (errFinal) {
            console.error(errFinal);
            setCameraAtiva(false);
            toast.info('Abrindo câmera nativa do aparelho para capturar o QR Code...');
            inputFotoQrRef.current?.click();
          }
        }
      }, 100);
    } catch {
      setCameraAtiva(false);
    }
  };

  const pararCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setCameraAtiva(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const processarQrCode = async (urlOuChave: string) => {
    if (!urlOuChave.trim()) {
      toast.aviso('Informe a URL do QR Code ou a Chave de Acesso de 44 dígitos');
      return;
    }

    try {
      setProcessando(true);
      setMensagemFallback(null);
      const res = await api.post('/notas-fiscais/parser-qrcode', { urlOuChave: urlOuChave.trim() });
      const data = res.data;

      if (!data.sucessoScraping && data.mensagem) {
        setMensagemFallback(data.mensagem);
      }

      setNota({
        chaveAcesso: data.chaveAcesso,
        numero: data.numero || '',
        serie: data.serie || '',
        dataEmissao: data.dataEmissao || new Date().toISOString(),
        fornecedor: data.fornecedor || { nome: 'Fornecedor da NFC-e', cnpjCpf: '' },
        valorTotal: data.valorTotal || 0,
        itens: data.itens || [],
      });

      setItensMapeados(mapearItensIniciais(data.itens || []));
    } catch (error: unknown) {
      toast.erro(mensagemDeErro(error, 'Erro ao processar QR Code da NFC-e'));
    } finally {
      setProcessando(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.aviso('Por favor, selecione um arquivo no formato .xml de NF-e');
      return;
    }

    try {
      setProcessando(true);
      setMensagemFallback(null);
      const xml = await file.text();
      const res = await api.post('/notas-fiscais/parser-xml', { xml });
      const data: NFeParseada = res.data;

      setNota(data);
      // Inicializa mapeamento com sugestões automáticas
      setItensMapeados(mapearItensIniciais(data.itens));
    } catch (error: unknown) {
      toast.erro(mensagemDeErro(error, 'Erro ao processar o arquivo XML da nota fiscal'));
    } finally {
      setProcessando(false);
    }
  };

  const adicionarItemManual = () => {
    setItensMapeados((prev) => [
      ...prev,
      {
        itemNumero: prev.length + 1,
        descricao: 'Item Manual',
        unidadeOriginal: 'UN',
        quantidadeOriginal: 1,
        valorUnitario: 0,
        incluir: true,
        insumoId: '',
        fatorConversao: 1,
      },
    ]);
  };

  const removerItem = (itemNumero: number) => {
    setItensMapeados((prev) => prev.filter((it) => it.itemNumero !== itemNumero));
  };

  const atualizarItem = <K extends keyof ItemMapeado>(itemNumero: number, campo: K, valor: ItemMapeado[K]) => {
    setItensMapeados((prev) =>
      prev.map((it) => {
        if (it.itemNumero !== itemNumero) return it;
        const atualizado = { ...it, [campo]: valor };

        // Se trocou de insumo, recalcula sugestão de conversão automática com as regras canônicas
        if (campo === 'insumoId' && typeof valor === 'string') {
          const insumoEscolhido = insumos.find((i) => i.id === valor);
          if (insumoEscolhido) {
            const conv = sugerirConversao(it.unidadeOriginal, insumoEscolhido.unidade, it.quantidadeOriginal);
            atualizado.fatorConversao = conv.fator;
            atualizado.conversaoIncerta = conv.conversaoIncerta;
          } else {
            atualizado.conversaoIncerta = false;
          }
        }

        // Se o operador editou o fator de conversão manualmente, a incerteza é resolvida
        if (campo === 'fatorConversao') {
          atualizado.conversaoIncerta = false;
        }
        return atualizado;
      })
    );
  };

  const confirmarEntrada = async () => {
    const itensParaSalvar = montarItensParaSalvar(itensMapeados);

    if (itensParaSalvar.length === 0) {
      toast.aviso('Selecione e vincule ao menos um item da nota fiscal para entrada de estoque.');
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
      toast.sucesso('Entrada de nota fiscal confirmada com sucesso!');
    } catch (error: unknown) {
      toast.erro(mensagemDeErro(error, 'Erro ao confirmar entrada de estoque'));
    } finally {
      setSalvando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink px-4 pt-4">
        <Passos atual={2} />
        <div className="flex flex-col items-center text-center pt-6">
          <Smash mood="celebrate" size={140} />
          <h1 className="text-xl font-bold mt-2">Estoque atualizado</h1>
          <p className="text-sm text-muted">
            {resultadoConfirmacao?.totalItensProcessados || 0} itens da nota entraram no estoque.
          </p>
        </div>
        <div className="bg-card border border-line rounded-3xl px-4 mt-5">
          {resultadoConfirmacao?.insumosAtualizados?.map((ins) => (
            <div key={ins.id} className="flex justify-between items-center gap-2 text-sm py-2.5 border-b border-line last:border-0">
              <span className="min-w-0 line-clamp-2 break-words">{ins.nome}</span>
              <span className="text-success font-bold shrink-0">+{ins.adicionado}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onVoltar}
          className="mt-5 w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer"
        >
          Voltar ao estoque
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink">
      {/* Header */}
      <div className="bg-canvas px-4 pt-4 pb-2 space-y-3 sticky top-0 z-10">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar"
            className="text-ink -ml-2 rounded-2xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer hover:bg-field"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold text-ink leading-tight">{nota ? 'Revisar itens' : 'Entrada por nota fiscal'}</h1>
        </div>
        <Passos atual={nota ? 1 : 0} />
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de Modo: Upload XML ou Scanner QR Code */}
        {!nota && (
          <div className="flex bg-card-2 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                pararCamera();
                setModoEntrada('xml');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                modoEntrada === 'xml'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-muted hover:text-ink '
              }`}
            >
              <UploadSimple size={15} /> Upload de XML (NF-e)
            </button>
            <button
              type="button"
              onClick={() => setModoEntrada('qrcode')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                modoEntrada === 'qrcode'
                  ? 'bg-card text-ink shadow-sm'
                  : 'text-muted hover:text-ink '
              }`}
            >
              <QrCode size={15} /> Scanner QR Code (NFC-e)
            </button>
          </div>
        )}

        {/* Upload Zone (Modo XML) */}
        {!nota && modoEntrada === 'xml' && (
          <div className="bg-card rounded-2xl border-2 border-dashed border-line p-8 flex flex-col items-center justify-center text-center space-y-3 hover:border-secondary/40 transition-colors">
            <div className="w-14 h-14 bg-secondary-soft text-secondary rounded-full flex items-center justify-center">
              <UploadSimple size={28} />
            </div>
            <div>
              <p className="font-semibold text-ink text-base">Selecione o arquivo XML da NF-e</p>
              <p className="text-xs text-muted mt-1">Arquivos no formato .xml emitidos pela SEFAZ</p>
            </div>
            <label className="bg-secondary hover:bg-secondary text-on-secondary font-medium text-sm px-6 py-2.5 rounded-xl cursor-pointer shadow-sm transition-colors">
              {processando ? (
                <span className="flex items-center gap-2">
                  <CircleNotch className="animate-spin" size={18} /> Lendo XML...
                </span>
              ) : (
                'Procurar Arquivo'
              )}
              <input type="file" accept=".xml" onChange={handleFileUpload} disabled={processando} className="hidden" />
            </label>
          </div>
        )}

        {/* Scanner Zone (Modo QR Code) */}
        {!nota && modoEntrada === 'qrcode' && (
          <div className="bg-card rounded-2xl border border-line p-5 shadow-sm space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-secondary-soft text-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <Camera size={24} />
              </div>
              <h2 className="text-base font-bold text-ink ">Leitor de QR Code de NFC-e</h2>
              <p className="text-xs text-muted mt-0.5">
                Aponte a câmera para o QR Code impresso no cupom fiscal da compra
              </p>
            </div>

            {/* Container oculto usado pelo Html5Qrcode.scanFile e input da câmera nativa */}
            <div id="qr-file-reader-hidden" className="hidden"></div>
            <input
              ref={inputFotoQrRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFotoQrCode}
              disabled={processando}
              className="hidden"
            />

            {/* Container da Câmera */}
            {cameraAtiva && (
              <div className="space-y-3">
                <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-secondary/40 bg-black min-h-[260px]"></div>
                <button
                  type="button"
                  onClick={pararCamera}
                  className="w-full py-2.5 bg-field hover:bg-card-2 text-ink text-xs font-semibold rounded-xl transition-colors"
                >
                  Fechar Câmera
                </button>
              </div>
            )}

            {!cameraAtiva && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={iniciarCamera}
                  disabled={processando}
                  className="w-full bg-secondary hover:bg-secondary text-on-secondary font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  {processando ? (
                    <>
                      <CircleNotch className="animate-spin" size={18} /> Processando QR Code...
                    </>
                  ) : (
                    <>
                      <Camera size={18} /> Abrir Câmera do Dispositivo
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => inputFotoQrRef.current?.click()}
                  disabled={processando}
                  className="w-full bg-field hover:bg-card-2 text-ink font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <UploadSimple size={15} /> Tirar Foto / Escolher Imagem do QR Code
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-card-2 "></div>
              <span className="text-[11px] font-bold text-faint uppercase">Ou digite / cole</span>
              <div className="flex-1 h-px bg-card-2 "></div>
            </div>

            {/* Entrada Manual de URL / Chave de 44 dígitos */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink block">
                URL do QR Code ou Chave de Acesso (44 dígitos):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chaveManual}
                  onChange={(e) => setChaveManual(e.target.value)}
                  placeholder="Ex: http://www.dfe.ms.gov.br/... ou 44 dígitos"
                  className="flex-1 text-xs p-2.5 border border-line rounded-xl bg-field text-ink focus:bg-card focus:outline-none focus:ring-2 focus:ring-secondary/40"
                />
                <button
                  type="button"
                  onClick={() => processarQrCode(chaveManual)}
                  disabled={processando || !chaveManual.trim()}
                  className="bg-success hover:bg-success text-canvas px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  {processando ? <CircleNotch className="animate-spin" size={14} /> : 'Consultar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resumo da Nota Parseada */}
        {nota && (
          <>
            {mensagemFallback && (
              <div className="bg-primary-soft border border-primary/40 text-brand p-3.5 rounded-xl text-xs flex gap-2 items-start">
                <WarningCircle size={18} className="text-brand shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Aviso da Consulta da SEFAZ</p>
                  <p className="mt-0.5 text-brand leading-relaxed">{mensagemFallback}</p>
                </div>
              </div>
            )}

            <div className="bg-card rounded-3xl border border-line p-4 space-y-2">
              <div className="flex justify-between items-start gap-3">
                {/* min-w-0: sem ele a chave de 44 dígitos empurrava o valor total para fora do card */}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary bg-secondary-soft px-2 py-0.5 rounded">
                    {nota.numero ? `NF-e / NFC-e nº ${nota.numero}` : 'Nota Fiscal'}
                  </span>
                  <h2 className="font-bold text-ink text-base mt-1">{nota.fornecedor.nome}</h2>
                  {nota.fornecedor.cnpjCpf && (
                    <p className="text-xs text-muted ">CNPJ: {nota.fornecedor.cnpjCpf}</p>
                  )}
                  {nota.chaveAcesso && (
                    <p className="text-[11px] text-faint font-mono mt-0.5 truncate">
                      Chave: {nota.chaveAcesso}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted">Valor total</p>
                  {nota.erroValorTotal ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-danger flex items-center gap-1">
                        <WarningCircle size={12} /> Ilegível
                      </span>
                      <span className="text-[10px] text-danger max-w-xs truncate" title={nota.erroValorTotal}>
                        {nota.erroValorTotal}
                      </span>
                    </div>
                  ) : (
                    <p className="font-bold text-ink text-base">
                      {formatarMoeda(Number(nota.valorTotal || 0))}
                    </p>
                  )}
                </div>
              </div>

              {(nota.totalItensComErro ?? 0) > 0 && (
                <div className="p-3 bg-danger-soft border border-danger/40 rounded-lg flex items-center gap-2 text-xs font-semibold text-danger ">
                  <WarningCircle size={16} className="text-danger shrink-0" />
                  <span>
                    Atenção: esta nota possui {nota.totalItensComErro} {nota.totalItensComErro === 1 ? 'item com leitura inválida' : 'itens com leitura inválida'}. Verifique os itens sinalizados abaixo.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-line flex justify-between items-center text-xs text-muted ">
                <span>{itensMapeados.length} itens vinculados</span>
                <button
                  type="button"
                  onClick={() => {
                    setNota(null);
                    setItensMapeados([]);
                    setMensagemFallback(null);
                  }}
                  className="text-secondary hover:underline cursor-pointer flex items-center gap-1 font-medium"
                >
                  <ArrowsClockwise size={12} /> Nova Leitura
                </button>
              </div>
            </div>

            {/* Lista de Itens para Mapeamento */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Conferência e Vínculo de Insumos
                </h3>
                <button
                  type="button"
                  onClick={adicionarItemManual}
                  className="text-xs text-secondary hover:text-secondary font-semibold flex items-center gap-1 cursor-pointer bg-secondary-soft hover:bg-secondary-soft px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Plus size={14} /> Adicionar Item
                </button>
              </div>

              {itensMapeados.map((item) => {
                const insumoSelecionado = insumos.find((i) => i.id === item.insumoId);
                const qtdConvertida = item.quantidadeOriginal * item.fatorConversao;

                return (
                  <div
                    key={item.itemNumero}
                    className={`bg-card rounded-xl border p-4 shadow-sm transition-colors space-y-3 ${
                      item.incluir ? 'border-line ' : 'border-line opacity-60 bg-field '
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={item.incluir}
                          onChange={(e) => atualizarItem(item.itemNumero, 'incluir', e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-line text-secondary"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.itemNumero, 'descricao', e.target.value)}
                            className="font-semibold text-ink text-sm leading-snug w-full bg-transparent hover:bg-field focus:bg-card border-b border-transparent focus:border-secondary/40 outline-none transition-colors"
                          />
                          <p className="text-xs text-muted mt-0.5">
                            Nota: <strong>{item.quantidadeOriginal} {item.unidadeOriginal}</strong> • {formatarMoeda(item.valorUnitario)}/{item.unidadeOriginal}
                          </p>

                          {/* Badge de Reconhecimento Inteligente */}
                          {item.confiancaMatch !== undefined && item.confiancaMatch >= 70 && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-success bg-success-soft border border-success/40 px-2 py-0.5 rounded-md w-fit">
                              <Sparkle size={12} className="text-success " />
                              <span>
                                {item.motivoMatch === 'HISTORICO'
                                  ? 'Reconhecido pelo histórico anterior (100%)'
                                  : item.motivoMatch === 'EXATO'
                                  ? 'Nome idêntico (99%)'
                                  : item.motivoMatch === 'SINONIMO'
                                  ? `Identificado por sinônimo (${item.confiancaMatch}%)`
                                  : `Identificado automaticamente (${item.confiancaMatch}%)`}
                              </span>
                            </div>
                          )}

                          {item.confiancaMatch !== undefined && item.confiancaMatch >= 35 && item.confiancaMatch < 70 && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-brand bg-primary-soft border border-primary/40 px-2 py-0.5 rounded-md w-fit">
                              <Question size={12} className="text-brand " />
                              <span>Sugestão aproximada ({item.confiancaMatch}%). Verifique se o vínculo está correto.</span>
                            </div>
                          )}

                          {(!item.confiancaMatch || item.confiancaMatch < 35) && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted bg-field border border-line px-2 py-0.5 rounded-md w-fit">
                              <span>Não reconhecido automaticamente. Selecione abaixo.</span>
                            </div>
                          )}

                          {item.erro && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-danger bg-danger-soft border border-danger/40 px-2 py-0.5 rounded-md w-fit">
                              <WarningCircle size={12} className="text-danger " />
                              <span>Atenção: {item.erro}</span>
                            </div>
                          )}

                          {item.insumoId && item.conversaoIncerta && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-brand bg-primary-soft border border-primary/40 px-2 py-0.5 rounded-md w-fit">
                              <WarningCircle size={12} className="text-brand " />
                              <span>Conversão 1:1 incerta para "{item.unidadeOriginal}". Verifique o fator de conversão abaixo.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removerItem(item.itemNumero)}
                        className="text-faint hover:text-danger p-1 rounded-lg transition-colors shrink-0"
                        title="Remover item"
                      >
                        <Trash size={16} />
                      </button>
                    </div>

                    {item.incluir && (
                      <div className="bg-field p-3 rounded-lg border border-line space-y-2 text-xs">
                        <div>
                          <label className="font-semibold text-ink block mb-1">
                            Vincular ao Insumo do Almoxarifado:
                          </label>
                          <select
                            value={item.insumoId}
                            onChange={(e) => atualizarItem(item.itemNumero, 'insumoId', e.target.value)}
                            className="w-full p-2 rounded-lg border border-line bg-card text-ink text-sm"
                          >
                            <option value="">Selecione o insumo...</option>
                            {insumos.map((ins) => (
                              <option key={ins.id} value={ins.id}>
                                {ins.nome} ({ins.unidade}) - Estoque atual: {ins.estoqueAtual}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Chips de Sugestões Alternativas se houver dúvida ou múltiplas opções */}
                        {item.outrasSugestoes && item.outrasSugestoes.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[11px] text-muted block mb-1">
                              Encontramos semelhança também com:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.outrasSugestoes.map((sug) => (
                                <button
                                  key={sug.insumoId}
                                  type="button"
                                  onClick={() => atualizarItem(item.itemNumero, 'insumoId', sug.insumoId)}
                                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                                    item.insumoId === sug.insumoId
                                      ? 'bg-secondary text-on-secondary border-secondary/40 font-bold'
                                      : 'bg-card text-ink border-line hover:bg-field '
                                  }`}
                                >
                                  {sug.insumoNome} ({sug.confianca}%)
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {insumoSelecionado && (
                          <div className="flex gap-2 items-center pt-1">
                            <div className="flex-1">
                              <label className="text-muted text-[11px] block">Fator de Conversão</label>
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={item.fatorConversao}
                                onChange={(e) =>
                                  atualizarItem(item.itemNumero, 'fatorConversao', Number(e.target.value) || 1)
                                }
                                className="w-full p-1.5 rounded border border-line bg-card text-ink text-sm"
                              />
                            </div>
                            <div className="flex-1 text-right">
                              <span className="text-[11px] text-muted block">Entrada no Estoque:</span>
                              <span className="text-sm font-bold text-success ">
                                +{formatarQuantidade(qtdConvertida, insumoSelecionado.unidade)}
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
                className="w-full bg-success text-canvas py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-success active:bg-success transition-colors shadow-sm disabled:opacity-50"
              >
                {salvando ? (
                  <>
                    <CircleNotch className="animate-spin" size={20} /> Confirmando Entrada...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} /> Confirmar Entrada no Estoque
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
