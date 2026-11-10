import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CircleNotch,
  Check,
  CheckCircle,
  Warning,
  X,
  CalendarX,
  CookingPot,
  WarningOctagon,
  DotsThreeCircle,
  MagnifyingGlass,
  ClockCounterClockwise,
} from '../components/ui/icons';
import Smash from '../components/brand/Smash';
import { api, mensagemDeErro } from '../lib/api';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { formatarMoeda, formatarQuantidade, formatarDataHora, normalizarBusca } from '../lib/formatar';
import { stagger, rise, tap } from '../lib/motion';

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

const MOTIVOS = [
  { id: 'VENCIMENTO' as const, label: 'Vencimento', cor: 'bg-danger text-canvas', icone: CalendarX },
  { id: 'ERRO_PREPARO' as const, label: 'Erro de preparo', cor: 'bg-primary text-on-primary', icone: CookingPot },
  { id: 'ESTRAGADO' as const, label: 'Estragado', cor: 'bg-danger-soft text-danger', icone: WarningOctagon },
  { id: 'OUTRO' as const, label: 'Outro', cor: 'bg-field text-ink', icone: DotsThreeCircle },
];

/** Cor da barra do resumo mensal por motivo (mesma família do botão). */
const COR_BARRA: Record<Motivo, string> = {
  VENCIMENTO: 'bg-danger',
  ERRO_PREPARO: 'bg-primary',
  ESTRAGADO: 'bg-danger',
  OUTRO: 'bg-muted',
};

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
  // Insumos com perda recente primeiro (atalho para os mais registrados), depois os demais
  const idsRecentes = [...new Set(perdas.map((p) => p.insumo?.id).filter(Boolean))] as string[];
  const ordenados = [
    ...idsRecentes.map((id) => insumos.find((i) => i.id === id)).filter((i): i is Insumo => !!i),
    ...insumos.filter((i) => !idsRecentes.includes(i.id)),
  ];
  const termo = normalizarBusca(busca);
  const filtrados = ordenados.filter((i) => normalizarBusca(i.nome).includes(termo));
  const totalMes = resumo.reduce((soma, r) => soma + (r.valorTotal ?? 0), 0);
  const maiorValor = Math.max(0, ...resumo.map((r) => r.valorTotal ?? 0));
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
        <motion.button
          type="button"
          whileTap={tap}
          onClick={tentarNovamenteInsumos}
          className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-medium cursor-pointer min-h-[44px] flex items-center justify-center shadow-sm"
        >
          Tentar novamente
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink transition-colors">
      <div className="px-4 pt-4 space-y-4">
        <h1 className="text-xl font-bold text-ink">Registrar perda</h1>

        {/* Aviso de estoque negativo */}
        {avisoEstoqueNegativo && (
          <div
            role="alert"
            className="bg-primary-soft border border-primary/40 text-brand p-3 rounded-2xl flex items-center gap-2 text-xs"
          >
            <Smash mood="alert" size={44} animated={false} />
            <span className="flex-1">{avisoEstoqueNegativo}</span>
            <button
              type="button"
              onClick={() => setAvisoEstoqueNegativo(null)}
              className="text-muted hover:text-ink cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 1. Insumo: busca + chips (com perda recente primeiro) */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
            <MagnifyingGlass size={18} className="text-muted shrink-0" />
            <input
              placeholder="Buscar insumo"
              aria-label="Buscar insumo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <p className="text-xs font-semibold text-muted">
            {busca.trim() ? `${filtrados.length} resultado(s)` : 'Mais registrados primeiro'}
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
            {filtrados.map((i) => {
              const ativo = insumoId === i.id;
              const recente = idsRecentes.includes(i.id);
              return (
                <motion.button
                  key={i.id}
                  whileTap={tap}
                  type="button"
                  onClick={() => setInsumoId(i.id)}
                  aria-pressed={ativo}
                  className={`shrink-0 max-w-[220px] flex items-center gap-1.5 px-3.5 rounded-full text-sm font-semibold cursor-pointer min-h-[44px] transition-colors ${
                    ativo ? 'bg-ink text-canvas' : 'bg-field text-ink hover:bg-card-2'
                  }`}
                >
                  {recente && !ativo && <ClockCounterClockwise size={14} className="text-muted shrink-0" />}
                  <span className="truncate">{i.nome}</span>
                </motion.button>
              );
            })}
            {filtrados.length === 0 && <p className="text-sm text-muted py-2">Nenhum insumo com esse nome.</p>}
          </div>
        </section>

        {/* 2. Insumo escolhido + quantidade */}
        <section className="bg-card border border-line rounded-3xl p-4 space-y-3">
          {selecionado ? (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink line-clamp-2 break-words">{selecionado.nome}</p>
                <p className="text-xs text-muted">
                  em estoque: {formatarQuantidade(selecionado.estoqueAtual, selecionado.unidade)}
                </p>
              </div>
              <CheckCircle size={22} weight="fill" className="text-primary shrink-0" />
            </div>
          ) : (
            <p className="text-sm text-muted">Escolha o insumo acima.</p>
          )}
          <div>
            <label htmlFor="perda-qtd" className="block text-xs font-semibold text-muted mb-1">
              Quantidade
            </label>
            <div className="flex items-center bg-field border border-line rounded-2xl px-3 min-h-[54px] focus-within:ring-2 focus-within:ring-primary/40">
              <input
                id="perda-qtd"
                type="text"
                inputMode="decimal"
                placeholder="0"
                aria-label="Quantidade"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full bg-transparent text-2xl font-bold text-ink placeholder:text-faint focus:outline-none"
              />
              {selecionado && <span className="text-sm text-muted shrink-0">{selecionado.unidade}</span>}
            </div>
          </div>
        </section>

        {/* 3. Motivo: um toque registra */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-muted">Toque no motivo para registrar</p>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS.map((m) => {
              const Icone = m.icone;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  whileTap={podeRegistrar ? tap : undefined}
                  disabled={!podeRegistrar || enviando}
                  onClick={() => void executarRegistrar(m.id)}
                  className={`rounded-2xl p-3 min-h-[76px] text-left font-semibold cursor-pointer flex flex-col justify-between disabled:opacity-40 disabled:cursor-not-allowed ${m.cor}`}
                >
                  <Icone size={24} weight="duotone" />
                  <span>{m.label}</span>
                </motion.button>
              );
            })}
          </div>
          {confirmado && (
            <p className="flex items-center justify-center gap-1 text-success font-medium text-sm">
              <Check size={16} weight="bold" /> Perda registrada com sucesso
            </p>
          )}
        </section>

        {/* Resumo do mês (carrega separado: se falhar, o registro continua) */}
        <section className="bg-card border border-line rounded-3xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-ink">Neste mês</h2>
            {totalMes > 0 && <p className="font-bold text-danger">{formatarMoeda(totalMes)}</p>}
          </div>
          {erroResumo ? (
            <div className="text-xs text-muted flex items-center justify-between gap-2">
              <span>{erroResumo.mensagem}</span>
              <button
                type="button"
                onClick={tentarNovamenteResumo}
                className="text-secondary font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center shrink-0"
              >
                Tentar novamente
              </button>
            </div>
          ) : carregandoResumo && resumo.length === 0 ? (
            <div className="h-16 rounded-xl bg-field animate-pulse" />
          ) : resumo.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma perda registrada neste mês.</p>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
              {resumo.map((r) => (
                <motion.div key={r.motivo} variants={rise}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink">
                      {rotulo(r.motivo)} <span className="text-muted">· {r.ocorrencias} registro(s)</span>
                    </span>
                    {r.valorTotal !== undefined && r.valorTotal > 0 ? (
                      <span className="font-semibold text-ink">{formatarMoeda(r.valorTotal)}</span>
                    ) : null}
                  </div>
                  <div className="h-2 rounded-full bg-card-2 overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${COR_BARRA[r.motivo]}`}
                      style={{ width: `${maiorValor > 0 ? Math.max(4, ((r.valorTotal ?? 0) / maiorValor) * 100) : 4}%` }}
                    />
                  </div>
                  {r.perdasSemCusto ? (
                    <p className="text-[11px] text-brand mt-0.5">{r.perdasSemCusto} perda(s) sem custo cadastrado</p>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>

        {/* Últimos registros (carrega separado) */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Últimos registros</h2>
          {erroPerdas ? (
            <div className="bg-card p-4 rounded-2xl border border-line text-xs text-muted flex items-center justify-between gap-2">
              <span>{erroPerdas.mensagem}</span>
              <button
                type="button"
                onClick={tentarNovamentePerdas}
                className="text-secondary font-bold hover:underline cursor-pointer min-h-[44px] px-2 flex items-center shrink-0"
              >
                Tentar novamente
              </button>
            </div>
          ) : carregandoPerdas && perdas.length === 0 ? (
            <div className="h-16 rounded-2xl bg-field animate-pulse" />
          ) : perdas.length === 0 ? (
            <p className="text-sm text-muted">Nenhum registro recente de perda.</p>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="bg-card border border-line rounded-3xl px-4"
            >
              {perdas.map((p) => (
                <motion.div
                  key={p.id}
                  variants={rise}
                  className="py-2.5 flex justify-between items-center gap-2 text-sm border-b border-line last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink line-clamp-2 break-words">{p.insumo?.nome}</p>
                    <p className="text-xs text-muted">
                      {rotulo(p.motivo)} • {formatarDataHora(p.criadoEm)}
                    </p>
                  </div>
                  <p className="font-bold text-danger shrink-0">-{formatarQuantidade(p.quantidade, p.insumo?.unidade)}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </div>
    </div>
  );
}
