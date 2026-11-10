import { useState, useCallback, useRef, useEffect } from 'react';
import { CircleNotch, Check, Warning, X } from '../components/ui/icons';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { formatarMoeda, formatarQuantidade, formatarDataHora } from '../lib/formatar';

export type Motivo = 'VENCIMENTO' | 'ERRO_PREPARO' | 'ESTRAGADO' | 'OUTRO';

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
}

export interface Perda {
  id: string;
  quantidade: number;
  motivo: Motivo;
  criadoEm: string;
  insumo: Insumo;
}

interface ResumoMotivo {
  motivo: Motivo;
  ocorrencias: number;
  valorTotal?: number;
  perdasSemCusto?: number;
}

const MOTIVOS: { id: Motivo; label: string; cor: string }[] = [
  { id: 'VENCIMENTO', label: 'Vencimento', cor: 'bg-danger text-white' },
  { id: 'ERRO_PREPARO', label: 'Erro de preparo', cor: 'bg-primary text-on-primary' },
  { id: 'ESTRAGADO', label: 'Estragado', cor: 'bg-danger-soft text-danger' },
  { id: 'OUTRO', label: 'Outro', cor: 'bg-field text-ink' },
];

const rotulo = (m: Motivo) => MOTIVOS.find((x) => x.id === m)?.label ?? m;

function parsearQuantidade(valor: string): number {
  const normalizado = valor.replace(',', '.').trim();
  const num = Number(normalizado);
  return !normalizado || isNaN(num) ? 0 : num;
}

export default function Perdas() {
  const [busca, setBusca] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [avisoEstoqueNegativo, setAvisoEstoqueNegativo] = useState<string | null>(null);

  const timerConfirmadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerConfirmadoRef.current) {
        clearTimeout(timerConfirmadoRef.current);
      }
    };
  }, []);

  const { toast, confirmar } = useFeedback();

  const buscarInsumos = useCallback(() => api.get<Insumo[]>('/insumos').then((r) => r.data), []);
  const buscarPerdas = useCallback(
    () => api.get<Perda[]>('/perdas', { params: { limite: 10 } }).then((r) => r.data),
    [],
  );
  const buscarResumo = useCallback(
    () => api.get<{ porMotivo: ResumoMotivo[] }>('/perdas/resumo-mensal').then((r) => r.data.porMotivo),
    [],
  );

  const {
    dados: insumosDados,
    carregandoInicial: carregandoInsumos,
    erro: erroInsumos,
    recarregar: recarregarInsumos,
    tentarNovamente: tentarNovamenteInsumos,
  } = useCarregamento(buscarInsumos, [], { mensagemPadrao: 'Erro ao carregar insumos.' });

  const {
    dados: perdasDados,
    carregandoInicial: carregandoPerdas,
    erro: erroPerdas,
    recarregar: recarregarPerdas,
    tentarNovamente: tentarNovamentePerdas,
  } = useCarregamento(buscarPerdas, [], { mensagemPadrao: 'Erro ao carregar histórico recente.' });

  const {
    dados: resumoDados,
    carregandoInicial: carregandoResumo,
    erro: erroResumo,
    recarregar: recarregarResumo,
    tentarNovamente: tentarNovamenteResumo,
  } = useCarregamento(buscarResumo, [], { mensagemPadrao: 'Erro ao carregar resumo de perdas.' });

  const insumos = insumosDados ?? [];
  const perdas = perdasDados ?? [];
  const resumo = resumoDados ?? [];

  const selecionado = insumos.find((i) => i.id === insumoId);
  const filtrados = insumos.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()));
  const qtdNumero = parsearQuantidade(quantidade);
  const podeRegistrar = !!selecionado && qtdNumero > 0;

  const { enviando, executar: executarRegistrar } = useEnvio(async (motivo: Motivo) => {
    if (!selecionado) return;
    const qtdNum = parsearQuantidade(quantidade);
    if (qtdNum <= 0) {
      toast.aviso('Informe uma quantidade maior que zero.');
      return;
    }
    if (qtdNum > selecionado.estoqueAtual) {
      const ok = await confirmar({
        titulo: 'Quantidade maior que o estoque',
        mensagem: `A quantidade a descartar (${formatarQuantidade(qtdNum, selecionado.unidade)}) é maior que o estoque atual (${formatarQuantidade(selecionado.estoqueAtual, selecionado.unidade)}). Deseja confirmar mesmo assim?`,
        textoConfirmar: 'Confirmar descarte',
        perigoso: true,
      });
      if (!ok) return;
    }

    try {
      const res = await api.post('/perdas', {
        insumoId,
        quantidade: qtdNum,
        motivo,
      });
      setQuantidade('');
      setConfirmado(true);
      if (timerConfirmadoRef.current) clearTimeout(timerConfirmadoRef.current);
      timerConfirmadoRef.current = setTimeout(() => setConfirmado(false), 2000);

      const novoEstoque = res.data?.insumo?.estoqueAtual;
      if (res.data?.estoqueNegativo) {
        const msgAviso = `O estoque de "${selecionado.nome}" ficou negativo (${formatarQuantidade(novoEstoque, selecionado.unidade)}). Confira o inventário.`;
        setAvisoEstoqueNegativo(msgAviso);
        toast.aviso(msgAviso);
      } else {
        setAvisoEstoqueNegativo(null);
      }

      await Promise.all([
        recarregarInsumos(),
        recarregarPerdas(),
        recarregarResumo(),
      ]);

      toast.sucesso(
        `Perda de ${formatarQuantidade(qtdNum, selecionado.unidade)} de "${selecionado.nome}" registrada.`,
      );
    } catch (error) {
      toast.erro(mensagemDeErro(error, 'Erro ao registrar perda.'));
    }
  });

  const adicionarQtd = (n: number) => {
    const atual = parsearQuantidade(quantidade);
    setQuantidade(String(atual + n));
  };

  if (carregandoInsumos) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted">
        <CircleNotch className="animate-spin mb-2" size={32} />
        <p>Carregando insumos...</p>
      </div>
    );
  }

  if (erroInsumos) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-danger-soft/20 flex items-center justify-center mb-4 text-danger">
          <Warning size={32} weight="duotone" />
        </div>
        <h2 className="text-lg font-bold text-ink mb-2">Erro ao carregar insumos</h2>
        <p className="text-sm text-muted max-w-sm mb-6">{erroInsumos.mensagem}</p>
        <button
          type="button"
          onClick={tentarNovamenteInsumos}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-medium cursor-pointer min-h-[44px] flex items-center justify-center shadow-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-20 bg-canvas text-ink transition-colors">
      <div className="bg-card px-4 pt-4 pb-3 border-b border-line sticky top-0 z-10 transition-colors">
        <h1 className="text-xl font-bold text-ink">Registro de Perdas</h1>
      </div>

      <div className="p-4 space-y-5">
        {/* Banner de estoque negativo */}
        {avisoEstoqueNegativo && (
          <div
            role="alert"
            className="bg-brand-soft/20 border border-brand/40 text-brand p-3 rounded-xl flex items-center justify-between text-xs"
          >
            <span>{avisoEstoqueNegativo}</span>
            <button
              type="button"
              onClick={() => setAvisoEstoqueNegativo(null)}
              className="p-1 text-muted hover:text-ink cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 1. Insumo */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">1. Insumo</h2>
          <input
            placeholder="Buscar insumo..."
            aria-label="Buscar insumo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full p-3 border border-line rounded-xl bg-field text-ink placeholder:text-faint min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
            {filtrados.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setInsumoId(i.id)}
                className={`p-3 rounded-xl border text-left text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                  insumoId === i.id
                    ? 'border-primary bg-primary-soft/30 text-ink font-bold shadow-sm'
                    : 'border-line bg-card text-ink hover:bg-field'
                }`}
              >
                {i.nome}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Quantidade */}
        <section className="space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
              2. Quantidade{selecionado ? ` (${selecionado.unidade})` : ''}
            </h2>
            {selecionado && (
              <span className="text-xs text-muted font-medium">
                Estoque atual: <strong className="text-ink">{formatarQuantidade(selecionado.estoqueAtual, selecionado.unidade)}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {[1, 10, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => adicionarQtd(n)}
                className="flex-1 py-3 rounded-xl bg-card border border-line font-semibold text-ink hover:bg-field cursor-pointer min-h-[44px] transition-colors"
              >
                +{n}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Quantidade"
            aria-label="Quantidade"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="w-full p-3 border border-line rounded-xl bg-field text-ink placeholder:text-faint min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </section>

        {/* 3. Motivo (um toque registra) */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">
            3. Motivo — toque para registrar
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {MOTIVOS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!podeRegistrar || enviando}
                onClick={() => void executarRegistrar(m.id)}
                className={`h-20 rounded-2xl font-bold text-base shadow-sm disabled:opacity-40 cursor-pointer transition-transform active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${m.cor}`}
              >
                <span>{m.label}</span>
              </button>
            ))}
          </div>
          {confirmado && (
            <p className="flex items-center justify-center gap-1 text-success font-medium text-sm">
              <Check size={16} /> Perda registrada com sucesso
            </p>
          )}
        </section>

        {/* Resumo do mês */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Perdas do mês</h2>
          {erroResumo ? (
            <div className="bg-card p-4 rounded-xl border border-line text-xs text-muted flex items-center justify-between">
              <span>{erroResumo.mensagem}</span>
              <button
                type="button"
                onClick={tentarNovamenteResumo}
                className="text-primary font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center"
              >
                Tentar novamente
              </button>
            </div>
          ) : carregandoResumo && resumo.length === 0 ? (
            <div className="h-16 rounded-xl bg-field animate-pulse" />
          ) : resumo.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma perda registrada neste mês.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {resumo.map((r) => (
                <div key={r.motivo} className="bg-card rounded-xl border border-line p-3 shadow-sm">
                  <p className="text-xs text-muted">{rotulo(r.motivo)}</p>
                  <p className="font-bold text-ink">{r.ocorrencias} registro(s)</p>
                  {r.valorTotal !== undefined && r.valorTotal > 0 ? (
                    <p className="text-xs font-semibold text-danger mt-0.5">
                      {formatarMoeda(r.valorTotal)}
                      {r.perdasSemCusto ? (
                        <span className="text-[11px] font-normal text-brand ml-1">
                          ({r.perdasSemCusto} s/ custo)
                        </span>
                      ) : null}
                    </p>
                  ) : r.perdasSemCusto ? (
                    <p className="text-[11px] text-brand mt-0.5">
                      {r.perdasSemCusto} perda(s) sem custo
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Histórico recente */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wider">Últimos registros</h2>
          {erroPerdas ? (
            <div className="bg-card p-4 rounded-xl border border-line text-xs text-muted flex items-center justify-between">
              <span>{erroPerdas.mensagem}</span>
              <button
                type="button"
                onClick={tentarNovamentePerdas}
                className="text-primary font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center"
              >
                Tentar novamente
              </button>
            </div>
          ) : carregandoPerdas && perdas.length === 0 ? (
            <div className="h-16 rounded-xl bg-field animate-pulse" />
          ) : perdas.length === 0 ? (
            <p className="text-sm text-muted">Nenhum registro recente de perda.</p>
          ) : (
            <div className="space-y-2">
              {perdas.map((p) => (
                <div key={p.id} className="bg-card rounded-xl border border-line p-3 flex justify-between items-center text-sm shadow-sm">
                  <div>
                    <p className="font-semibold text-ink">{p.insumo?.nome}</p>
                    <p className="text-xs text-muted">
                      {rotulo(p.motivo)} • {formatarDataHora(p.criadoEm)}
                    </p>
                  </div>
                  <p className="font-bold text-danger">
                    -{formatarQuantidade(p.quantidade, p.insumo?.unidade)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
