import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, QrCode, Camera, CheckCircle2, Loader2, RefreshCw, Sparkles, HelpCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { sugerirConversao } from '../lib/unidades';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
}

interface SugestaoAlternativa {
  insumoId: string;
  insumoNome: string;
  unidade: string;
  confianca: number;
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
  conversaoIncerta?: boolean;
  erro?: string;
  confiancaMatch?: number;
  motivoMatch?: 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM';
  outrasSugestoes?: SugestaoAlternativa[];
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
  erroValorTotal?: string;
  totalItensComErro?: number;
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
  conversaoIncerta?: boolean;
  erro?: string;
  confiancaMatch?: number;
  motivoMatch?: 'HISTORICO' | 'EXATO' | 'SINONIMO' | 'SIMILARIDADE' | 'NENHUM';
  outrasSugestoes?: SugestaoAlternativa[];
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

function tocarBipScanner() {
  const somAtivo = localStorage.getItem('cfg_som_scanner') !== 'false';
  if (somAtivo && typeof window !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Ignora se o navegador bloquear autoplay de áudio
    }
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(120);
    } catch {
      // Ignora erro de vibração
    }
  }
}

interface BarcodeDetectorLike {
  detect: (image: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
}

function redimensionarImagem(file: File, maxDimensao: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxDimensao / Math.max(img.width, img.height));
      const largura = Math.max(1, Math.round(img.width * escala));
      const altura = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement('canvas');
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponível'));
        return;
      }
      ctx.drawImage(img, 0, 0, largura, altura);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao converter imagem'));
            return;
          }
          resolve(new File([blob], 'qrcode.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    img.src = url;
  });
}

async function decodificarQrDeArquivo(file: File): Promise<string> {
  // 1. Tenta BarcodeDetector nativo do navegador mobile (rápido e lida bem com fotos de alta resolução)
  const BarcodeDetectorCtor = (
    window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
  ).BarcodeDetector;
  if (BarcodeDetectorCtor && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });
      const codigos = await detector.detect(bitmap);
      bitmap.close?.();
      const valor = codigos.find((c) => c.rawValue?.trim())?.rawValue?.trim();
      if (valor) return valor;
    } catch {
      // Segue para o fallback do Html5Qrcode
    }
  }

  // 2. Tenta Html5Qrcode.scanFile na imagem original e em versões redimensionadas (fotos de 12MP+ do celular)
  const leitor = new Html5Qrcode('qr-file-reader-hidden');
  try {
    return await leitor.scanFile(file, false);
  } catch {
    for (const dim of [1600, 1000, 700]) {
      try {
        const reduzida = await redimensionarImagem(file, dim);
        return await leitor.scanFile(reduzida, false);
      } catch {
        // Tenta próxima resolução
      }
    }
  } finally {
    try {
      leitor.clear();
    } catch {
      // Ignora limpeza
    }
  }

  throw new Error('Não foi possível identificar um QR Code nítido na foto. Aproxime a câmera do QR Code e tente novamente.');
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

      const mapeamentoInicial: ItemMapeado[] = (data.itens || []).map((it: ItemNFeExtraido) => ({
        itemNumero: it.itemNumero,
        descricao: it.descricao,
        unidadeOriginal: it.unidadeOriginal,
        quantidadeOriginal: it.quantidadeOriginal,
        valorUnitario: it.valorUnitario,
        incluir: !it.erro && !!it.sugestaoInsumoId,
        insumoId: it.sugestaoInsumoId || '',
        fatorConversao: it.fatorConversaoSugerido || 1,
        conversaoIncerta: it.conversaoIncerta,
        erro: it.erro,
        confiancaMatch: it.confiancaMatch,
        motivoMatch: it.motivoMatch,
        outrasSugestoes: it.outrasSugestoes,
      }));
      setItensMapeados(mapeamentoInicial);
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
      const mapeamentoInicial: ItemMapeado[] = data.itens.map((it) => ({
        itemNumero: it.itemNumero,
        descricao: it.descricao,
        unidadeOriginal: it.unidadeOriginal,
        quantidadeOriginal: it.quantidadeOriginal,
        valorUnitario: it.valorUnitario,
        incluir: !it.erro && !!it.sugestaoInsumoId,
        insumoId: it.sugestaoInsumoId || '',
        fatorConversao: it.fatorConversaoSugerido || 1,
        conversaoIncerta: it.conversaoIncerta,
        erro: it.erro,
        confiancaMatch: it.confiancaMatch,
        motivoMatch: it.motivoMatch,
        outrasSugestoes: it.outrasSugestoes,
      }));
      setItensMapeados(mapeamentoInicial);
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
      <div className="flex flex-col min-h-full pb-20 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Entrada Confirmada</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Estoque Atualizado com Sucesso!</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs">
            Foram atualizados {resultadoConfirmacao?.totalItensProcessados || 0} insumos no almoxarifado a partir da NF-e.
          </p>

          <div className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left space-y-2 mt-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Itens Incrementados:</h3>
            {resultadoConfirmacao?.insumosAtualizados?.map((ins) => (
              <div key={ins.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="font-medium text-gray-800 dark:text-gray-200">{ins.nome}</span>
                <span className="text-green-600 dark:text-green-400 font-bold">+{ins.adicionado}</span>
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
    <div className="flex flex-col min-h-full pb-20 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onVoltar} className="text-gray-600 dark:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">Entrada por Nota Fiscal</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Upload e leitura de XML de NF-e</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Seletor de Modo: Upload XML ou Scanner QR Code */}
        {!nota && (
          <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => {
                pararCamera();
                setModoEntrada('xml');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                modoEntrada === 'xml'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Upload size={15} /> Upload de XML (NF-e)
            </button>
            <button
              type="button"
              onClick={() => setModoEntrada('qrcode')}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                modoEntrada === 'qrcode'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <QrCode size={15} /> Scanner QR Code (NFC-e)
            </button>
          </div>
        )}

        {/* Upload Zone (Modo XML) */}
        {!nota && modoEntrada === 'xml' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 flex flex-col items-center justify-center text-center space-y-3 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
              <Upload size={28} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-base">Selecione o arquivo XML da NF-e</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Arquivos no formato .xml emitidos pela SEFAZ</p>
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

        {/* Scanner Zone (Modo QR Code) */}
        {!nota && modoEntrada === 'qrcode' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <Camera size={24} />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Leitor de QR Code de NFC-e</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
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
                <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border-2 border-blue-500 bg-black min-h-[260px]"></div>
                <button
                  type="button"
                  onClick={pararCamera}
                  className="w-full py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition-colors"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  {processando ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Processando QR Code...
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
                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Upload size={15} /> Tirar Foto / Escolher Imagem do QR Code
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase">Ou digite / cole</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            </div>

            {/* Entrada Manual de URL / Chave de 44 dígitos */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
                URL do QR Code ou Chave de Acesso (44 dígitos):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chaveManual}
                  onChange={(e) => setChaveManual(e.target.value)}
                  placeholder="Ex: http://www.dfe.ms.gov.br/... ou 44 dígitos"
                  className="flex-1 text-xs p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => processarQrCode(chaveManual)}
                  disabled={processando || !chaveManual.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                >
                  {processando ? <Loader2 className="animate-spin" size={14} /> : 'Consultar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resumo da Nota Parseada */}
        {nota && (
          <>
            {mensagemFallback && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3.5 rounded-xl text-xs flex gap-2 items-start">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Aviso da Consulta da SEFAZ</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed">{mensagemFallback}</p>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                    {nota.numero ? `NF-e / NFC-e nº ${nota.numero}` : 'Nota Fiscal'}
                  </span>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base mt-1">{nota.fornecedor.nome}</h2>
                  {nota.fornecedor.cnpjCpf && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">CNPJ: {nota.fornecedor.cnpjCpf}</p>
                  )}
                  {nota.chaveAcesso && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate max-w-xs">
                      Chave: {nota.chaveAcesso}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Valor Total</p>
                  {nota.erroValorTotal ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle size={12} /> Ilegível
                      </span>
                      <span className="text-[10px] text-rose-500 dark:text-rose-400 max-w-xs truncate" title={nota.erroValorTotal}>
                        {nota.erroValorTotal}
                      </span>
                    </div>
                  ) : (
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-base">
                      R$ {Number(nota.valorTotal || 0).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {(nota.totalItensComErro ?? 0) > 0 && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                  <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>
                    Atenção: esta nota possui {nota.totalItensComErro} {nota.totalItensComErro === 1 ? 'item com leitura inválida' : 'itens com leitura inválida'}. Verifique os itens sinalizados abaixo.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>{itensMapeados.length} itens vinculados</span>
                <button
                  type="button"
                  onClick={() => {
                    setNota(null);
                    setItensMapeados([]);
                    setMensagemFallback(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1 font-medium"
                >
                  <RefreshCw size={12} /> Nova Leitura
                </button>
              </div>
            </div>

            {/* Lista de Itens para Mapeamento */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Conferência e Vínculo de Insumos
                </h3>
                <button
                  type="button"
                  onClick={adicionarItemManual}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1 rounded-lg transition-colors"
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
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm transition-colors space-y-3 ${
                      item.incluir ? 'border-gray-200 dark:border-gray-700' : 'border-gray-200 dark:border-gray-700 opacity-60 bg-gray-50/50 dark:bg-gray-800/50'
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
                        <div className="flex-1">
                          <input
                            type="text"
                            value={item.descricao}
                            onChange={(e) => atualizarItem(item.itemNumero, 'descricao', e.target.value)}
                            className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug w-full bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700 focus:bg-white dark:focus:bg-gray-700 border-b border-transparent focus:border-blue-500 outline-none transition-colors"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Nota: <strong>{item.quantidadeOriginal} {item.unidadeOriginal}</strong> • R$ {item.valorUnitario.toFixed(2)}/{item.unidadeOriginal}
                          </p>

                          {/* Badge de Reconhecimento Inteligente */}
                          {item.confiancaMatch !== undefined && item.confiancaMatch >= 70 && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md w-fit">
                              <Sparkles size={12} className="text-emerald-600 dark:text-emerald-400" />
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
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md w-fit">
                              <HelpCircle size={12} className="text-amber-600 dark:text-amber-400" />
                              <span>Sugestão aproximada ({item.confiancaMatch}%). Verifique se o vínculo está correto.</span>
                            </div>
                          )}

                          {(!item.confiancaMatch || item.confiancaMatch < 35) && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-md w-fit">
                              <span>Não reconhecido automaticamente. Selecione abaixo.</span>
                            </div>
                          )}

                          {item.erro && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md w-fit">
                              <AlertCircle size={12} className="text-rose-600 dark:text-rose-400" />
                              <span>Atenção: {item.erro}</span>
                            </div>
                          )}

                          {item.insumoId && item.conversaoIncerta && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md w-fit">
                              <AlertCircle size={12} className="text-amber-600 dark:text-amber-400" />
                              <span>Conversão 1:1 incerta para "{item.unidadeOriginal}". Verifique o fator de conversão abaixo.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removerItem(item.itemNumero)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-lg transition-colors shrink-0"
                        title="Remover item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {item.incluir && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2 text-xs">
                        <div>
                          <label className="font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                            Vincular ao Insumo do Almoxarifado:
                          </label>
                          <select
                            value={item.insumoId}
                            onChange={(e) => atualizarItem(item.itemNumero, 'insumoId', e.target.value)}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
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
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 block mb-1">
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
                                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                              <label className="text-gray-500 dark:text-gray-400 text-[11px] block">Fator de Conversão</label>
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={item.fatorConversao}
                                onChange={(e) =>
                                  atualizarItem(item.itemNumero, 'fatorConversao', Number(e.target.value) || 1)
                                }
                                className="w-full p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                            <div className="flex-1 text-right">
                              <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Entrada no Estoque:</span>
                              <span className="text-sm font-bold text-green-700 dark:text-green-400">
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
