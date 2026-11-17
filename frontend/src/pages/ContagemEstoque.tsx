import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  WarningCircle,
} from '../components/ui/icons';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { api } from '../lib/api';
import { categoriaDoInsumo, type CategoriaInsumo } from '../lib/categoriaInsumo';
import { gerarChaveIdempotencia } from '../lib/chaveIdempotencia';
import {
  SUGESTOES_MOTIVO_CONTAGEM,
  calcularPreviaItemContagem,
  chaveConteudoContagem,
  classificarErroContagem,
  siglaUnidadeBase,
  textoConfirmacaoContagem,
  unidadeAlternativa,
  validarContagemEstoque,
  type EntradaContagemInsumo,
  type ErroEnvioContagem,
  type RegistrarAjusteEstoqueResultado,
} from '../lib/contagemEstoque';
import type { InsumoParaEntrada, ModoUnidade } from '../lib/entradaManual';
import { formatarQuantidade, normalizarBusca } from '../lib/formatar';

export interface ContagemEstoqueProps {
  onVoltar: () => void;
  onSucesso?: () => void;
}

const CATEGORIAS_FILTRO: ReadonlyArray<{ id: 'TODOS' | CategoriaInsumo; rotulo: string }> = [
  { id: 'TODOS', rotulo: 'Todos' },
  { id: 'INGREDIENTE', rotulo: 'Ingrediente' },
  { id: 'EMBALAGEM', rotulo: 'Embalagem' },
  { id: 'BEBIDA', rotulo: 'Bebida' },
];

const AVISO_CONTAGEM =
  'O saldo de cada item passa a ser o valor contado. Lance as vendas do dia antes de contar.';

export default function ContagemEstoque({ onVoltar, onSucesso }: ContagemEstoqueProps) {
  const { confirmar } = useFeedback();
  const tentativaRef = useRef<{ conteudo: string; chave: string } | null>(null);
  const voltarAbertoRef = useRef(false);

  const [motivo, setMotivo] = useState('');
  const [entradas, setEntradas] = useState<Record<string, EntradaContagemInsumo>>({});
  const [abaCategoria, setAbaCategoria] = useState<'TODOS' | CategoriaInsumo>('TODOS');
  const [busca, setBusca] = useState('');
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<ErroEnvioContagem | null>(null);
  const [resultado, setResultado] = useState<RegistrarAjusteEstoqueResultado | null>(null);

  const buscarInsumos = useCallback(
    () => api.get<InsumoParaEntrada[]>('/insumos').then((r) => r.data),
    [],
  );

  const {
    dados: insumosDados,
    carregandoInicial,
    erro: erroCarga,
    recarregar: recarregarInsumos,
    tentarNovamente,
  } = useCarregamento(buscarInsumos, [], {
    mensagemPadrao: 'Não foi possível carregar os insumos.',
  });

  const insumos = useMemo(() => insumosDados ?? [], [insumosDados]);
  const mapaInsumos = useMemo(
    () => new Map(insumos.map((ins) => [ins.id, ins])),
    [insumos],
  );

  const atualizarEntrada = useCallback(
    (insumoId: string, patch: { texto?: string; modoUnidade?: ModoUnidade }) => {
      setErroEnvio(null);
      setEntradas((prev) => {
        const atual = prev[insumoId] ?? { texto: '', modoUnidade: 'BASE' as ModoUnidade };
        return {
          ...prev,
          [insumoId]: { ...atual, ...patch },
        };
      });
    },
    [],
  );

  const validacao = useMemo(
    () => validarContagemEstoque(insumos, entradas, motivo),
    [insumos, entradas, motivo],
  );
  const errosExibidos = tentouEnviar ? validacao.erros : { porInsumo: {} };

  const insumosFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    return insumos.filter((ins) => {
      if (abaCategoria !== 'TODOS' && categoriaDoInsumo(ins) !== abaCategoria) {
        return false;
      }
      if (termo && !normalizarBusca(ins.nome).includes(termo)) {
        return false;
      }
      return true;
    });
  }, [insumos, abaCategoria, busca]);

  const resumoRodape = useMemo(() => {
    let contados = 0;
    let comDiferenca = 0;
    for (const ins of insumos) {
      const entrada = entradas[ins.id];
      const previa = calcularPreviaItemContagem(
        ins,
        entrada?.texto ?? '',
        entrada?.modoUnidade ?? 'BASE',
      );
      if (previa.preenchido) {
        contados++;
        if (previa.valido && previa.diferenca !== null && previa.diferenca !== 0) {
          comDiferenca++;
        }
      }
    }
    return { contados, comDiferenca };
  }, [insumos, entradas]);

  const { enviando, executar: executarEnviar } = useEnvio(async () => {
    const check = validarContagemEstoque(insumos, entradas, motivo);
    if (!check.valido) {
      setTentouEnviar(true);
      return;
    }

    const ok = await confirmar({
      titulo: 'Confirmar contagem de estoque',
      mensagem: textoConfirmacaoContagem(check.itensResumo),
      textoConfirmar: 'Confirmar',
    });
    if (!ok) return;

    setErroEnvio(null);
    const conteudoAtual = chaveConteudoContagem(motivo, check.itensPayload);
    if (!tentativaRef.current || tentativaRef.current.conteudo !== conteudoAtual) {
      tentativaRef.current = {
        conteudo: conteudoAtual,
        chave: gerarChaveIdempotencia(),
      };
    }

    const insumosSelecionados = check.itensPayload.map((it) => ({
      id: it.insumoId,
      nome: mapaInsumos.get(it.insumoId)?.nome ?? it.insumoId,
    }));

    try {
      const resp = await api.post<RegistrarAjusteEstoqueResultado>('/estoque/ajustes', {
        chaveIdempotencia: tentativaRef.current.chave,
        motivo: motivo.trim(),
        itens: check.itensPayload,
      });
      setResultado(resp.data);
      onSucesso?.();
      void recarregarInsumos();
    } catch (error) {
      const classificado = classificarErroContagem(error, insumosSelecionados);
      if (classificado.tipo === 'conflito') {
        tentativaRef.current = null;
      }
      setErroEnvio(classificado);
    }
  });

  const lidarRegistrar = useCallback(() => {
    if (!validacao.valido) {
      setTentouEnviar(true);
      return;
    }
    void executarEnviar();
  }, [validacao.valido, executarEnviar]);

  const formularioPreenchido = useMemo(
    () =>
      motivo.trim() !== '' ||
      Object.values(entradas).some((entrada) => entrada.texto.trim() !== ''),
    [motivo, entradas],
  );

  const lidarVoltar = useCallback(async () => {
    if (!formularioPreenchido) {
      onVoltar();
      return;
    }
    if (voltarAbertoRef.current) return;
    voltarAbertoRef.current = true;
    try {
      const ok = await confirmar({
        titulo: 'Descartar contagem',
        mensagem: 'Você preencheu valores nesta contagem. Deseja sair e descartar o preenchimento?',
        textoConfirmar: 'Descartar',
        perigoso: true,
      });
      if (ok) {
        onVoltar();
      }
    } finally {
      voltarAbertoRef.current = false;
    }
  }, [formularioPreenchido, confirmar, onVoltar]);

  if (resultado) {
    return (
      <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink">
        <div className="px-4 pt-4 pb-2 space-y-2">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <CheckCircle size={24} weight="fill" className="text-success shrink-0" />
            Contagem registrada
          </h1>
          {resultado.reaproveitado && (
            <p
              role="status"
              className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs font-semibold text-secondary"
            >
              Esta contagem já tinha sido registrada.
            </p>
          )}
        </div>

        <div className="px-4 pt-2 space-y-4 flex-1">
          <section className="space-y-2" aria-label="Saldos ajustados">
            <h2 className="text-sm font-bold text-ink">Saldos atualizados</h2>
            <ul className="space-y-2">
              {resultado.itens.map((item) => {
                const sigla = siglaUnidadeBase(item.unidade);
                const difTexto =
                  item.diferenca > 0
                    ? `+${formatarQuantidade(Math.abs(item.diferenca), sigla)}`
                    : item.diferenca < 0
                      ? `−${formatarQuantidade(Math.abs(item.diferenca), sigla)}`
                      : formatarQuantidade(0, sigla);
                const classeDif =
                  item.diferenca > 0
                    ? 'text-success'
                    : item.diferenca < 0
                      ? 'text-danger'
                      : 'text-muted';

                return (
                  <li
                    key={item.insumoId}
                    className="bg-card border border-line rounded-2xl px-3.5 py-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-ink min-w-0 break-words">
                        {item.nome}
                      </span>
                      <span className={`text-xs font-bold shrink-0 tabular-nums ${classeDif}`}>
                        {difTexto}
                      </span>
                    </div>
                    <p className="text-xs text-muted tabular-nums">
                      saldo {formatarQuantidade(item.saldoAnterior)} →{' '}
                      {formatarQuantidade(item.saldoContado)} {sigla} ({difTexto})
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="bg-card-2 border border-line rounded-2xl px-3.5 py-2.5 text-xs text-muted">
            {AVISO_CONTAGEM}
          </p>

          <div className="sticky bottom-20 pt-1 z-20">
            <button
              type="button"
              onClick={onVoltar}
              className="w-full bg-primary hover:bg-primary-deep text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer shadow-primary"
            >
              Voltar ao estoque
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-28 bg-canvas text-ink">
      <div className="bg-canvas px-4 pt-4 pb-2 sticky top-0 z-10 border-b border-line/60">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void lidarVoltar()}
            aria-label="Voltar"
            className="text-ink -ml-2 rounded-2xl min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer hover:bg-field"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink leading-tight">Contagem de estoque</h1>
            <p className="text-xs text-muted">Ajuste pelo saldo físico na prateleira</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4 flex-1">
        {erroCarga && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/40 text-danger p-3.5 rounded-2xl text-xs flex gap-2 items-center"
          >
            <WarningCircle size={18} className="shrink-0" />
            <p className="flex-1 font-semibold">{erroCarga.mensagem}</p>
            <button
              type="button"
              onClick={tentarNovamente}
              className="shrink-0 min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink font-bold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {carregandoInicial && !erroCarga && (
          <p className="text-sm text-muted flex items-center gap-2">
            <CircleNotch size={16} className="animate-spin" /> Carregando insumos…
          </p>
        )}

        <div className="space-y-2">
          <label
            htmlFor="contagem-motivo"
            className="block text-xs font-semibold text-muted"
          >
            Motivo da contagem
          </label>
          <input
            id="contagem-motivo"
            type="text"
            aria-label="Motivo da contagem"
            maxLength={500}
            placeholder="Ex.: Contagem semanal"
            value={motivo}
            onChange={(e) => {
              setErroEnvio(null);
              setMotivo(e.target.value);
            }}
            className="w-full bg-field border border-line rounded-2xl px-3 min-h-[46px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugestões de motivo">
            {SUGESTOES_MOTIVO_CONTAGEM.map((sugestao) => {
              const ativo = motivo.trim() === sugestao;
              return (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => {
                    setErroEnvio(null);
                    setMotivo(sugestao);
                  }}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    ativo
                      ? 'bg-primary-soft border-brand text-brand'
                      : 'bg-card border-line text-muted hover:text-ink'
                  }`}
                >
                  {sugestao}
                </button>
              );
            })}
          </div>
          {errosExibidos.motivo && (
            <p className="text-xs text-danger font-semibold">{errosExibidos.motivo}</p>
          )}
        </div>

        <div className="space-y-2">
          <div
            role="tablist"
            aria-label="Categorias da contagem"
            className="flex gap-1 bg-field p-1 rounded-2xl overflow-x-auto"
          >
            {CATEGORIAS_FILTRO.map((cat) => {
              const ativa = abaCategoria === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaCategoria(cat.id)}
                  className={`flex-1 min-h-[44px] px-2.5 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    ativa ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {cat.rotulo}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 bg-field border border-line rounded-2xl px-3 min-h-[46px] focus-within:ring-2 focus-within:ring-primary/40">
            <MagnifyingGlass size={18} className="text-muted shrink-0" />
            <input
              type="search"
              aria-label="Buscar insumo na contagem"
              placeholder="Buscar insumo por nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
        </div>

        {errosExibidos.geral && (
          <p role="alert" className="text-xs text-danger font-semibold">
            {errosExibidos.geral}
          </p>
        )}

        <ul className="space-y-2.5">
          {insumosFiltrados.map((insumo) => {
            const entrada = entradas[insumo.id] ?? { texto: '', modoUnidade: 'BASE' as ModoUnidade };
            const alt = unidadeAlternativa(insumo.unidade);
            const siglaBase = siglaUnidadeBase(insumo.unidade);
            const siglaAtual =
              alt && entrada.modoUnidade === 'ALTERNATIVA' ? alt.siglaAlt : siglaBase;
            const previa = calcularPreviaItemContagem(
              insumo,
              entrada.texto,
              entrada.modoUnidade,
            );
            const erroInsumo = errosExibidos.porInsumo[insumo.id] ?? (previa.preenchido && !previa.valido ? previa.erro : undefined);

            return (
              <li
                key={insumo.id}
                className="bg-card border border-line rounded-2xl p-3.5 space-y-2.5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-ink break-words">{insumo.nome}</p>
                    <p className="text-xs text-muted mt-0.5 tabular-nums">
                      Sistema: {formatarQuantidade(insumo.estoqueAtual, insumo.unidade)}
                    </p>
                  </div>

                  {alt && (
                    <div
                      className="inline-flex rounded-xl bg-field p-1 border border-line shrink-0 gap-1"
                      role="group"
                      aria-label={`Unidade de digitação de ${insumo.nome}`}
                    >
                      <button
                        type="button"
                        aria-pressed={entrada.modoUnidade === 'BASE'}
                        aria-label={`Usar ${alt.siglaBase} em ${insumo.nome}`}
                        onClick={() => atualizarEntrada(insumo.id, { modoUnidade: 'BASE' })}
                        className={`min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          entrada.modoUnidade === 'BASE'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {alt.siglaBase}
                      </button>
                      <button
                        type="button"
                        aria-pressed={entrada.modoUnidade === 'ALTERNATIVA'}
                        aria-label={`Usar ${alt.siglaAlt} em ${insumo.nome}`}
                        onClick={() =>
                          atualizarEntrada(insumo.id, { modoUnidade: 'ALTERNATIVA' })
                        }
                        className={`min-h-[44px] min-w-[44px] px-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                          entrada.modoUnidade === 'ALTERNATIVA'
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {alt.siglaAlt}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <label
                      htmlFor={`contado-${insumo.id}`}
                      className="block text-[11px] font-semibold text-muted mb-1"
                    >
                      Contado ({siglaAtual}) — vazio = não contado
                    </label>
                    <input
                      id={`contado-${insumo.id}`}
                      type="text"
                      inputMode="decimal"
                      aria-label={`Contado de ${insumo.nome}`}
                      placeholder="Não contado"
                      value={entrada.texto}
                      onChange={(e) => atualizarEntrada(insumo.id, { texto: e.target.value })}
                      className="w-full bg-field border border-line rounded-xl px-3 min-h-[44px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40 tabular-nums"
                    />
                  </div>

                  {previa.preenchido && previa.valido && previa.textoDiferenca && (
                    <span
                      className={`shrink-0 mt-5 text-xs font-bold px-2.5 py-1.5 rounded-xl tabular-nums ${
                        previa.sinalDiferenca === 'positivo'
                          ? 'bg-success-soft text-success'
                          : previa.sinalDiferenca === 'negativo'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-field text-muted'
                      }`}
                    >
                      {previa.textoDiferenca}
                    </span>
                  )}
                </div>

                {previa.textoEquivalencia && (
                  <p className="text-xs font-semibold text-secondary">
                    {previa.textoEquivalencia}
                  </p>
                )}

                {erroInsumo && (
                  <p className="text-xs text-danger font-semibold">{erroInsumo}</p>
                )}
              </li>
            );
          })}
        </ul>

        {erroEnvio && (
          <div
            role="alert"
            className="bg-danger-soft border border-danger/40 text-danger p-3.5 rounded-2xl text-xs font-semibold flex gap-2 items-start"
          >
            <WarningCircle size={18} className="shrink-0 mt-0.5" />
            <p className="flex-1 break-words">{erroEnvio.mensagem}</p>
          </div>
        )}

        <p className="bg-card-2 border border-line rounded-2xl px-3.5 py-2.5 text-xs text-muted">
          {AVISO_CONTAGEM}
        </p>

        <div className="sticky bottom-20 pt-1 z-20 space-y-2">
          <div className="bg-card border border-line rounded-2xl px-3.5 py-2 text-xs font-semibold text-ink flex items-center justify-between gap-2 shadow-[var(--shadow-card)]">
            <span>
              {resumoRodape.contados}{' '}
              {resumoRodape.contados === 1 ? 'item contado' : 'itens contados'} ·{' '}
              {resumoRodape.comDiferenca} com diferença
            </span>
          </div>
          <button
            type="button"
            disabled={enviando}
            onClick={lidarRegistrar}
            className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer shadow-primary"
          >
            {enviando ? 'Registrando…' : 'Registrar contagem'}
          </button>
        </div>
      </div>
    </div>
  );
}
