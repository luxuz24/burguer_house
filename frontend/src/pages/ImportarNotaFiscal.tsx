import Smash from '../components/brand/Smash';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, UploadSimple, QrCode, Camera, CheckCircle, CircleNotch, ArrowsClockwise, Sparkle, Question, WarningCircle, Warning, Plus, Trash, Storefront } from '../components/ui/icons';
import { Html5Qrcode } from 'html5-qrcode';
import { api, mensagemDeErro } from '../lib/api';
import { formatarMoeda, formatarQuantidade } from '../lib/formatar';
import { useFeedback } from '../context/FeedbackContext';
import { sugerirConversao } from '../lib/unidades';
import { tocarBipScanner } from '../lib/bipScanner';
import { decodificarQrDeArquivo } from '../lib/qrImagem';
import {
  LIMITE_XML_CARACTERES,
  dataEmissaoValida,
  estaVinculado,
  formatarFator,
  mapearItensIniciais,
  montarItensParaSalvar,
  parsearFator,
  pendenciasDaConfirmacao,
  proximoItemNumero,
  textoDataEmissao,
  textoPendencias,
  type ItemMapeado,
  type NFeParseada,
} from '../lib/notaFiscal';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';

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
  const { toast, confirmar } = useFeedback();
  const [processando, setProcessando] = useState(false);
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
  // Timer que monta o leitor depois que o container da câmera aparece; cancelado ao sair da tela.
  const timerCameraRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montadoRef = useRef(true);
  // A câmera entrega o mesmo QR a cada quadro até parar: só a primeira leitura vale.
  const leituraTratadaRef = useRef(false);

  const buscarInsumos = useCallback(async () => (await api.get<Insumo[]>('/insumos')).data, []);
  const {
    dados: insumosCarregados,
    erro: erroInsumos,
    tentarNovamente: recarregarInsumos,
  } = useCarregamento(buscarInsumos, [], { mensagemPadrao: 'Não foi possível carregar os insumos.' });
  const insumos = useMemo(() => insumosCarregados ?? [], [insumosCarregados]);
  const idsInsumos = useMemo(() => new Set(insumos.map((i) => i.id)), [insumos]);

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
      leituraTratadaRef.current = false;
      timerCameraRef.current = setTimeout(async () => {
        timerCameraRef.current = null;
        if (!montadoRef.current) return;
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        const configScanner = { fps: 10, qrbox: { width: 250, height: 250 } };
        const onScanSuccess = (decodedText: string) => {
          if (leituraTratadaRef.current) return;
          leituraTratadaRef.current = true;
          tocarBipScanner();
          pararCamera();
          processarQrCode(decodedText);
        };

        try {
          await scanner.start({ facingMode: 'environment' }, configScanner, onScanSuccess, () => {});
          pararSeDesmontado(scanner);
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
            pararSeDesmontado(scanner);
          } catch (errFinal) {
            if (!montadoRef.current) return;
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

  // A tela pode sair enquanto o start() da câmera ainda está pendente: desliga assim que ele terminar.
  const pararSeDesmontado = (scanner: Html5Qrcode) => {
    if (!montadoRef.current && scanner.isScanning) {
      scanner.stop().catch(() => {});
    }
  };

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (timerCameraRef.current) {
        clearTimeout(timerCameraRef.current);
        timerCameraRef.current = null;
      }
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
        dataEmissao: data.dataEmissao,
        dataEmissaoAproximada: data.dataEmissaoAproximada === true,
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
    // Zera o input: sem isso, escolher de novo o mesmo arquivo (após um erro) não dispara onChange.
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.aviso('Por favor, selecione um arquivo no formato .xml de NF-e');
      return;
    }

    try {
      setProcessando(true);
      setMensagemFallback(null);
      // UTF-8 usa até 4 bytes por caractere: acima disso nem vale ler o arquivo.
      const xml = file.size > LIMITE_XML_CARACTERES * 4 ? null : await file.text();
      if (xml === null || xml.length > LIMITE_XML_CARACTERES) {
        toast.aviso('O arquivo XML passa do limite de 500 KB aceito pelo servidor.');
        return;
      }
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
        itemNumero: proximoItemNumero(prev),
        descricao: 'Item Manual',
        unidadeOriginal: 'UN',
        quantidadeOriginal: 1,
        valorUnitario: 0,
        incluir: true,
        insumoId: '',
        fatorConversao: 1,
        fatorTexto: '1',
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
            atualizado.fatorTexto = formatarFator(conv.fator);
            atualizado.conversaoIncerta = conv.conversaoIncerta;
          } else {
            atualizado.conversaoIncerta = false;
          }
        }

        // Se o operador editou o fator de conversão manualmente, a incerteza é resolvida.
        // O texto fica como digitado ("0," a caminho de "0,001"); inválido vira NaN e bloqueia a confirmação.
        if (campo === 'fatorTexto' && typeof valor === 'string') {
          atualizado.fatorConversao = parsearFator(valor) ?? Number.NaN;
          atualizado.conversaoIncerta = false;
        }
        return atualizado;
      })
    );
  };

  const pendencias = pendenciasDaConfirmacao(itensMapeados, idsInsumos);
  const textosPendencia = textoPendencias(pendencias);
  const bloqueado = textosPendencia.length > 0;
  const totalVinculados = itensMapeados.filter((it) => estaVinculado(it, idsInsumos)).length;
  const unidadeDoInsumo = (id: string) => insumos.find((i) => i.id === id)?.unidade;

  // useEnvio: trava síncrona cobre o duplo clique e o intervalo em que o diálogo de conversão está aberto.
  const { enviando: salvando, executar: executarConfirmacao } = useEnvio(async () => {
    if (!nota || bloqueado) return;
    const itensParaSalvar = montarItensParaSalvar(itensMapeados, idsInsumos);

    if (itensParaSalvar.length === 0) {
      toast.aviso('Selecione e vincule ao menos um item da nota fiscal para entrada de estoque.');
      return;
    }

    const incertos = pendencias.conversaoIncerta;
    if (incertos.length > 0) {
      const ok = await confirmar({
        titulo: 'Conversão a conferir',
        mensagem:
          `${incertos.length === 1 ? '1 item está' : `${incertos.length} itens estão`} com conversão 1:1 incerta ` +
          `(${incertos.map((it) => `${it.descricao} em ${it.unidadeOriginal}`).join('; ')}). ` +
          'Confira o fator antes de dar entrada no estoque.',
        textoConfirmar: 'Confirmar mesmo assim',
        textoCancelar: 'Revisar',
      });
      if (!ok) return;
    }

    try {
      const res = await api.post('/notas-fiscais/confirmar', {
        chaveAcesso: nota.chaveAcesso,
        numero: nota.numero,
        serie: nota.serie,
        fornecedorNome: nota.fornecedor.nome,
        fornecedorCnpj: nota.fornecedor.cnpjCpf,
        valorTotal: nota.valorTotal,
        dataEmissao: dataEmissaoValida(nota.dataEmissao),
        itens: itensParaSalvar,
      });
      setResultadoConfirmacao(res.data);
      setSucesso(true);
      toast.sucesso('Entrada de nota fiscal confirmada com sucesso!');
    } catch (error: unknown) {
      toast.erro(mensagemDeErro(error, 'Erro ao confirmar entrada de estoque'));
    }
  });

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
              <span className="text-success font-bold shrink-0">+{formatarQuantidade(ins.adicionado, unidadeDoInsumo(ins.id))}</span>
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
        {erroInsumos && (
          <div role="alert" className="bg-danger-soft border border-danger/40 text-danger p-3.5 rounded-xl text-xs flex gap-2 items-center">
            <WarningCircle size={18} className="shrink-0" />
            <p className="flex-1 font-semibold">Não foi possível carregar os insumos. Sem eles não dá para vincular os itens da nota.</p>
            <button
              type="button"
              onClick={recarregarInsumos}
              className="shrink-0 min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink font-bold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

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

        {/* Passo 2 — Revisar (telas.html#nf2): cabeçalho da nota num card e itens em lista */}
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
              <div className="flex items-center gap-3">
                <span className="w-[38px] h-[38px] rounded-xl bg-secondary-soft text-secondary grid place-items-center shrink-0">
                  <Storefront size={20} weight="duotone" />
                </span>
                {/* min-w-0: sem ele a chave de 44 dígitos empurrava o valor total para fora do card */}
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-ink text-sm leading-snug line-clamp-2 break-words">{nota.fornecedor.nome}</h2>
                  <p className="text-xs text-muted">
                    {nota.numero ? `NF-e ${nota.numero}` : 'Nota fiscal'} · {itensMapeados.length}{' '}
                    {itensMapeados.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {nota.erroValorTotal ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-danger flex items-center gap-1">
                        <WarningCircle size={12} /> Ilegível
                      </span>
                      <span className="text-[10px] text-danger max-w-[8rem] truncate" title={nota.erroValorTotal}>
                        {nota.erroValorTotal}
                      </span>
                    </div>
                  ) : (
                    <p className="font-bold text-ink text-base">{formatarMoeda(Number(nota.valorTotal || 0))}</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted space-y-0.5">
                <p>{textoDataEmissao(nota.dataEmissao, nota.dataEmissaoAproximada)}</p>
                {nota.fornecedor.cnpjCpf && <p>CNPJ: {nota.fornecedor.cnpjCpf}</p>}
                {nota.chaveAcesso && (
                  <p className="text-[11px] text-faint font-mono truncate">Chave: {nota.chaveAcesso}</p>
                )}
              </div>

              {(nota.totalItensComErro ?? 0) > 0 && (
                <div className="p-3 bg-danger-soft border border-danger/40 rounded-lg flex items-center gap-2 text-xs font-semibold text-danger ">
                  <WarningCircle size={16} className="text-danger shrink-0" />
                  <span>
                    Atenção: esta nota possui {nota.totalItensComErro} {nota.totalItensComErro === 1 ? 'item com leitura inválida' : 'itens com leitura inválida'}. Verifique os itens sinalizados abaixo.
                  </span>
                </div>
              )}

              <div className="pt-1 border-t border-line flex justify-end">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => {
                    setNota(null);
                    setItensMapeados([]);
                    setMensagemFallback(null);
                  }}
                  className="min-h-[44px] px-2 text-xs text-secondary hover:underline cursor-pointer flex items-center gap-1 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowsClockwise size={12} /> Nova Leitura
                </button>
              </div>
            </div>

            {/* Lista de itens: texto da nota em cinza, insumo vinculado embaixo */}
            <div className="flex justify-between items-center px-1">
              <p className="text-xs font-semibold text-muted">
                {totalVinculados} de {itensMapeados.length} itens vinculados
              </p>
              <button
                type="button"
                onClick={adicionarItemManual}
                className="min-h-[44px] text-xs text-secondary font-semibold flex items-center gap-1 cursor-pointer bg-secondary-soft px-3 rounded-xl transition-colors"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <ul aria-label="Itens da nota" className="space-y-2">
              {itensMapeados.map((item) => {
                const insumoSelecionado = insumos.find((i) => i.id === item.insumoId);
                const fatorValido = Number.isFinite(item.fatorConversao) && item.fatorConversao > 0;
                const qtdConvertida = item.quantidadeOriginal * item.fatorConversao;
                const semVinculo = item.incluir && !insumoSelecionado;

                return (
                  <li
                    key={item.itemNumero}
                    className={`bg-card rounded-2xl border p-3.5 transition-colors ${
                      semVinculo ? 'border-primary' : 'border-line'
                    } ${item.incluir ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.incluir}
                        aria-label={`Incluir ${item.descricao}`}
                        onChange={(e) => atualizarItem(item.itemNumero, 'incluir', e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-line accent-secondary shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.descricao}
                          aria-label="Descrição na nota"
                          onChange={(e) => atualizarItem(item.itemNumero, 'descricao', e.target.value)}
                          className="text-xs text-muted font-semibold uppercase w-full bg-transparent hover:bg-field focus:bg-card border-b border-transparent focus:border-secondary/40 outline-none transition-colors"
                        />
                        <p className="text-[11px] text-faint mt-0.5">
                          Nota: <strong>{formatarQuantidade(item.quantidadeOriginal, item.unidadeOriginal)}</strong> • {formatarMoeda(item.valorUnitario)}/{item.unidadeOriginal}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerItem(item.itemNumero)}
                        aria-label="Remover item"
                        title="Remover item"
                        className="text-faint hover:text-danger min-h-[44px] min-w-[44px] -mr-2 -mt-2 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                      >
                        <Trash size={18} />
                      </button>
                    </div>

                    {/* Selos de reconhecimento e alertas do item */}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {item.confiancaMatch !== undefined && item.confiancaMatch >= 70 && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success-soft border border-success/40 px-2 py-0.5 rounded-md">
                          <Sparkle size={12} className="text-success " />
                          {item.motivoMatch === 'HISTORICO'
                            ? 'Reconhecido pelo histórico anterior (100%)'
                            : item.motivoMatch === 'EXATO'
                            ? 'Nome idêntico (99%)'
                            : item.motivoMatch === 'SINONIMO'
                            ? `Identificado por sinônimo (${item.confiancaMatch}%)`
                            : `Identificado automaticamente (${item.confiancaMatch}%)`}
                        </span>
                      )}
                      {item.confiancaMatch !== undefined && item.confiancaMatch >= 35 && item.confiancaMatch < 70 && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-primary-soft border border-primary/40 px-2 py-0.5 rounded-md">
                          <Question size={12} className="text-brand " />
                          Sugestão aproximada ({item.confiancaMatch}%). Verifique se o vínculo está correto.
                        </span>
                      )}
                      {item.erro && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-danger bg-danger-soft border border-danger/40 px-2 py-0.5 rounded-md">
                          <WarningCircle size={12} className="text-danger " />
                          Atenção: {item.erro}
                        </span>
                      )}
                      {insumoSelecionado && item.conversaoIncerta && (
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-primary-soft border border-primary/40 px-2 py-0.5 rounded-md">
                          <WarningCircle size={12} className="text-brand " />
                          Conversão 1:1 incerta para "{item.unidadeOriginal}". Verifique o fator de conversão abaixo.
                        </span>
                      )}
                    </div>

                    {item.incluir && (
                      <div className="mt-2 space-y-2 text-xs">
                        {insumoSelecionado ? (
                          <>
                            {/* Vinculado: insumo em destaque e a conversão em chip */}
                            <div className="flex items-center gap-1.5">
                              <CheckCircle size={16} weight="fill" className="text-success shrink-0" />
                              <span className="font-bold text-ink text-sm flex-1 min-w-0 truncate">{insumoSelecionado.nome}</span>
                              {fatorValido && (
                                <span className="text-[11px] font-semibold bg-field text-muted px-2 py-0.5 rounded-full shrink-0">
                                  1 {item.unidadeOriginal} = {formatarQuantidade(item.fatorConversao, insumoSelecionado.unidade)}
                                </span>
                              )}
                            </div>
                            <select
                              value={item.insumoId}
                              aria-label="Trocar insumo vinculado"
                              onChange={(e) => atualizarItem(item.itemNumero, 'insumoId', e.target.value)}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-line bg-field text-ink text-sm"
                            >
                              <option value="">Escolher insumo</option>
                              {insumos.map((ins) => (
                                <option key={ins.id} value={ins.id}>
                                  {ins.nome} ({ins.unidade}) - Estoque atual: {formatarQuantidade(ins.estoqueAtual)}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          /* Sem vínculo: "Escolher insumo" destacado em laranja (telas.html#nf2) */
                          <label className="flex items-center gap-2 min-h-[48px] px-3 rounded-2xl border-2 border-primary bg-primary-soft text-brand">
                            <Warning size={16} weight="fill" className="shrink-0" />
                            <select
                              value=""
                              aria-label="Escolher insumo"
                              onChange={(e) => atualizarItem(item.itemNumero, 'insumoId', e.target.value)}
                              className="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm font-semibold text-brand outline-none cursor-pointer"
                            >
                              <option value="">Escolher insumo</option>
                              {insumos.map((ins) => (
                                <option key={ins.id} value={ins.id}>
                                  {ins.nome} ({ins.unidade}) - Estoque atual: {formatarQuantidade(ins.estoqueAtual)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {/* Sugestões alternativas se houver dúvida ou múltiplas opções */}
                        {item.outrasSugestoes && item.outrasSugestoes.length > 0 && (
                          <div>
                            <span className="text-[11px] text-muted block mb-1">Encontramos semelhança também com:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {item.outrasSugestoes.map((sug) => (
                                <button
                                  key={sug.insumoId}
                                  type="button"
                                  onClick={() => atualizarItem(item.itemNumero, 'insumoId', sug.insumoId)}
                                  className={`text-[11px] min-h-[32px] px-2.5 rounded-full border transition-colors cursor-pointer ${
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
                          <div className="flex gap-2 items-start bg-field rounded-xl p-2.5">
                            <div className="flex-1">
                              <label className="text-muted text-[11px] block" htmlFor={`fator-${item.itemNumero}`}>
                                Fator de conversão
                              </label>
                              <input
                                id={`fator-${item.itemNumero}`}
                                type="text"
                                inputMode="decimal"
                                value={item.fatorTexto}
                                aria-invalid={!fatorValido}
                                onChange={(e) => atualizarItem(item.itemNumero, 'fatorTexto', e.target.value)}
                                className={`w-full min-h-[40px] px-2 rounded-lg border bg-card text-ink text-sm ${fatorValido ? 'border-line' : 'border-danger'}`}
                              />
                              {!fatorValido && (
                                <p className="text-[11px] text-danger font-semibold mt-0.5">Informe um fator maior que zero</p>
                              )}
                            </div>
                            <div className="flex-1 text-right">
                              <span className="text-[11px] text-muted block">Entrada no estoque</span>
                              <span className="text-sm font-bold text-success ">
                                {fatorValido ? `+${formatarQuantidade(qtdConvertida, insumoSelecionado.unidade)}` : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Ações */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void executarConfirmacao()}
                disabled={salvando || bloqueado}
                className="w-full bg-success text-canvas min-h-[50px] rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
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
              {textosPendencia.map((t) => (
                <p key={t} className="text-xs text-center text-brand font-semibold mt-2">{t}</p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
