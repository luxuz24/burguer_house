import { useCallback, useState } from 'react';
import { api, mensagemDeErro } from '../lib/api';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { formatarDataHora, formatarQuantidade } from '../lib/formatar';
import { siglaUnidadeBase } from '../lib/entradaManual';
import {
  CircleNotch,
  ClockCounterClockwise,
  User,
  WarningCircle,
} from './ui/icons';

export interface MovimentacaoEstoqueItem {
  id: string;
  tipo: string;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitario: number | null;
  observacao: string | null;
  criadoEm: string;
  insumo: {
    id: string;
    nome: string;
    unidade: string;
  };
  usuario: {
    id: string;
    nome: string;
  } | null;
}

export interface RespostaMovimentacoesEstoque {
  total: number;
  limite: number;
  offset: number;
  movimentacoes: MovimentacaoEstoqueItem[];
}

export interface HistoricoMovimentacoesProps {
  insumoId: string;
  unidadeInsumo: string;
}

const LIMITE_RESUMO = 20;
const LIMITE_COMPLETO = 50;

const ROTULOS_TIPO_MOVIMENTACAO: Record<string, string> = {
  ENTRADA_MANUAL: 'Entrada manual',
  AJUSTE: 'Ajuste',
};

const formatadorCustoMovimentacao = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function rotuloTipoMovimentacao(tipo: string): string {
  return ROTULOS_TIPO_MOVIMENTACAO[tipo] ?? tipo;
}

function valorVariacaoAssinada(mov: MovimentacaoEstoqueItem): number {
  if (mov.quantidade < 0) return mov.quantidade;
  if (mov.saldoPosterior < mov.saldoAnterior && mov.quantidade > 0) {
    return -mov.quantidade;
  }
  return mov.quantidade;
}

function formatarVariacaoMovimentacao(
  mov: MovimentacaoEstoqueItem,
  sigla: string,
): { texto: string; sinal: 'positivo' | 'negativo' | 'neutro' } {
  const valor = valorVariacaoAssinada(mov);
  if (valor > 0) {
    return {
      texto: `+${formatarQuantidade(Math.abs(valor), sigla)}`,
      sinal: 'positivo',
    };
  }
  if (valor < 0) {
    return {
      texto: `−${formatarQuantidade(Math.abs(valor), sigla)}`,
      sinal: 'negativo',
    };
  }
  return {
    texto: formatarQuantidade(0, sigla),
    sinal: 'neutro',
  };
}

function formatarCustoPorUnidade(custoUnitario: number | null, sigla: string): string | null {
  if (typeof custoUnitario !== 'number' || !Number.isFinite(custoUnitario) || custoUnitario <= 0) {
    return null;
  }
  return `${formatadorCustoMovimentacao.format(custoUnitario)}/${sigla}`;
}

export function HistoricoMovimentacoes({
  insumoId,
  unidadeInsumo,
}: HistoricoMovimentacoesProps) {
  const [modoCompleto, setModoCompleto] = useState(false);
  const [extras, setExtras] = useState<{
    baseRef: RespostaMovimentacoesEstoque | null;
    itens: MovimentacaoEstoqueItem[];
    total: number | null;
  }>({ baseRef: null, itens: [], total: null });
  const [erroCarregarMais, setErroCarregarMais] = useState<string | null>(null);

  const limiteInicial = modoCompleto ? LIMITE_COMPLETO : LIMITE_RESUMO;

  const buscarInicial = useCallback(async (): Promise<RespostaMovimentacoesEstoque> => {
    const resp = await api.get<RespostaMovimentacoesEstoque>('/estoque/movimentacoes', {
      params: { insumoId, limite: limiteInicial },
    });
    return resp?.data ?? { total: 0, limite: limiteInicial, offset: 0, movimentacoes: [] };
  }, [insumoId, limiteInicial]);

  const {
    dados: paginaInicial,
    carregandoInicial,
    erro,
    tentarNovamente,
  } = useCarregamento(buscarInicial, [insumoId, limiteInicial], {
    mensagemPadrao: 'Não foi possível carregar as movimentações.',
  });

  const extrasAtivos = extras.baseRef === paginaInicial ? extras.itens : [];
  const movimentacoes = paginaInicial
    ? [...paginaInicial.movimentacoes, ...extrasAtivos]
    : [];
  const total =
    extras.baseRef === paginaInicial && extras.total !== null
      ? extras.total
      : (paginaInicial?.total ?? 0);

  const { enviando: carregandoMais, executar: carregarMais } = useEnvio(async () => {
    if (!paginaInicial) return;
    const offsetAtual = movimentacoes.length;
    try {
      const resp = await api.get<RespostaMovimentacoesEstoque>('/estoque/movimentacoes', {
        params: { insumoId, limite: LIMITE_COMPLETO, offset: offsetAtual },
      });
      const dados = resp?.data ?? {
        total,
        limite: LIMITE_COMPLETO,
        offset: offsetAtual,
        movimentacoes: [],
      };
      setErroCarregarMais(null);
      setExtras((anterior) => {
        const listaAnterior = anterior.baseRef === paginaInicial ? anterior.itens : [];
        const idsExistentes = new Set([
          ...paginaInicial.movimentacoes.map((m) => m.id),
          ...listaAnterior.map((m) => m.id),
        ]);
        const novos = dados.movimentacoes.filter((m) => !idsExistentes.has(m.id));
        return {
          baseRef: paginaInicial,
          itens: [...listaAnterior, ...novos],
          total: dados.total,
        };
      });
    } catch (err: unknown) {
      setErroCarregarMais(
        mensagemDeErro(err, 'Não foi possível carregar mais movimentações.'),
      );
    }
  });

  const siglaFallback = siglaUnidadeBase(unidadeInsumo);

  return (
    <section aria-labelledby="titulo-movimentacoes-insumo" className="pt-2 border-t border-line space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3
          id="titulo-movimentacoes-insumo"
          className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5"
        >
          <ClockCounterClockwise size={15} weight="duotone" />
          <span>Movimentações</span>
        </h3>

        {!modoCompleto && extrasAtivos.length === 0 && paginaInicial && total > 0 && (
          <button
            type="button"
            onClick={() => setModoCompleto(true)}
            className="min-h-[44px] px-2.5 -mr-1 rounded-xl text-xs font-bold text-secondary hover:bg-secondary-soft cursor-pointer transition-colors"
          >
            {total > LIMITE_RESUMO ? `Ver tudo (${total})` : 'Ver tudo'}
          </button>
        )}

        {(modoCompleto || extrasAtivos.length > 0) && paginaInicial && (
          <span className="text-[11px] font-semibold text-muted">
            {movimentacoes.length} de {total}
          </span>
        )}
      </div>

      {carregandoInicial && (
        <p className="text-xs text-muted flex items-center gap-2 py-2">
          <CircleNotch size={14} className="animate-spin shrink-0" />
          <span>Carregando movimentações…</span>
        </p>
      )}

      {!carregandoInicial && erro && (
        <div
          role="alert"
          className="bg-danger-soft border border-danger/40 text-danger rounded-2xl p-3 text-xs space-y-2"
        >
          <div className="flex items-start gap-2">
            <WarningCircle size={16} className="shrink-0 mt-0.5" />
            <p className="font-semibold flex-1 break-words">{erro.mensagem}</p>
          </div>
          <button
            type="button"
            onClick={tentarNovamente}
            className="min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink text-xs font-bold cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!carregandoInicial && !erro && paginaInicial && movimentacoes.length === 0 && (
        <p className="text-xs text-muted bg-card-2 border border-line rounded-2xl p-3 text-center">
          Nenhuma movimentação manual neste insumo.
        </p>
      )}

      {!carregandoInicial && !erro && movimentacoes.length > 0 && (
        <ul className="space-y-2">
          {movimentacoes.map((mov) => {
            const sigla = siglaUnidadeBase(mov.insumo?.unidade || unidadeInsumo) || siglaFallback;
            const variacao = formatarVariacaoMovimentacao(mov, sigla);
            const custo = formatarCustoPorUnidade(mov.custoUnitario, sigla);
            const autor = mov.usuario?.nome?.trim() ? mov.usuario.nome : 'Usuário removido';

            return (
              <li
                key={mov.id}
                className="bg-card-2 border border-line rounded-2xl p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink leading-snug">
                      {rotuloTipoMovimentacao(mov.tipo)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatarDataHora(mov.criadoEm)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums ${
                      variacao.sinal === 'positivo'
                        ? 'bg-success-soft text-success'
                        : variacao.sinal === 'negativo'
                          ? 'bg-danger-soft text-danger'
                          : 'bg-field text-muted'
                    }`}
                  >
                    {variacao.texto}
                  </span>
                </div>

                <p className="text-xs text-muted tabular-nums">
                  saldo {formatarQuantidade(mov.saldoAnterior)} →{' '}
                  {formatarQuantidade(mov.saldoPosterior)} {sigla}
                  {custo ? ` · ${custo}` : ''}
                </p>

                {mov.observacao?.trim() && (
                  <p className="text-xs text-ink-soft break-words">
                    {mov.observacao.trim()}
                  </p>
                )}

                <p className="text-[11px] text-muted flex items-center gap-1">
                  <User size={12} weight="bold" className="shrink-0" />
                  <span>{autor}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {erroCarregarMais && (
        <p role="alert" className="text-xs text-danger font-semibold">
          {erroCarregarMais}
        </p>
      )}

      {!carregandoInicial && !erro && movimentacoes.length < total && (
        <button
          type="button"
          disabled={carregandoMais}
          onClick={() => void carregarMais()}
          className="w-full min-h-[44px] bg-field hover:bg-card-2 border border-line text-ink rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          {carregandoMais ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </section>
  );
}
