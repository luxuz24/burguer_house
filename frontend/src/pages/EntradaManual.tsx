import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  Package,
  Plus,
  Trash,
  Warning,
  WarningCircle,
} from '../components/ui/icons';
import { useFeedback } from '../context/FeedbackContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { useVoltarDoAparelho } from '../hooks/useVoltarDoAparelho';
import { api } from '../lib/api';
import { categoriaDoInsumo, type CategoriaInsumo } from '../lib/categoriaInsumo';
import { gerarChaveIdempotencia } from '../lib/chaveIdempotencia';
import {
  MENSAGEM_ERRO_MILHAR,
  PADRAO_MILHAR,
  chaveConteudoEntrada,
  classificarErroEntrada,
  converterCustoParaBase,
  converterQuantidadeParaBase,
  parsearCustoEntrada,
  parsearQuantidadeEntrada,
  siglaUnidadeBase,
  textoConfirmacaoEntrada,
  unidadeAlternativa,
  validarLinhasEntrada,
  type ErroEnvioEntrada,
  type InsumoParaEntrada,
  type LinhaEntradaManual,
  type RegistrarEntradaManualResultado,
} from '../lib/entradaManual';
import { formatarQuantidade, normalizarBusca } from '../lib/formatar';

export interface EntradaManualProps {
  onVoltar: () => void;
  onSucesso?: () => void;
}

const CATEGORIAS_FILTRO: ReadonlyArray<{ id: 'TODOS' | CategoriaInsumo; rotulo: string }> = [
  { id: 'TODOS', rotulo: 'Todos' },
  { id: 'INGREDIENTE', rotulo: 'Ingrediente' },
  { id: 'EMBALAGEM', rotulo: 'Embalagem' },
  { id: 'BEBIDA', rotulo: 'Bebida' },
];

// Quantos resultados da busca aparecem por item; acima disso, pede para digitar mais do nome.
const LIMITE_RESULTADOS_BUSCA = 8;

const AVISO_PERMANENTE =
  'Se a nota fiscal aparecer depois, não importe de novo: o sistema não consegue ver que é a mesma compra.';

function criarLinha(id: string): LinhaEntradaManual {
  return {
    id,
    insumoId: '',
    quantidadeTexto: '',
    custoTexto: '',
    modoUnidade: 'BASE',
    buscaInsumo: '',
    filtroCategoria: 'TODOS',
  };
}

export default function EntradaManual({ onVoltar, onSucesso }: EntradaManualProps) {
  const { confirmar } = useFeedback();
  const proximoIdRef = useRef(2);
  const tentativaRef = useRef<{ conteudo: string; chave: string } | null>(null);

  const [observacao, setObservacao] = useState('');
  const [linhas, setLinhas] = useState<LinhaEntradaManual[]>(() => [criarLinha('linha-1')]);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<ErroEnvioEntrada | null>(null);
  const [resultado, setResultado] = useState<RegistrarEntradaManualResultado | null>(null);

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

  const validacao = useMemo(
    () => validarLinhasEntrada(linhas, mapaInsumos, observacao),
    [linhas, mapaInsumos, observacao],
  );
  const errosExibidos = tentouEnviar ? validacao.erros : { porLinha: {} };

  const atualizarLinha = useCallback((id: string, patch: Partial<LinhaEntradaManual>) => {
    setErroEnvio(null);
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const adicionarLinha = useCallback(() => {
    setErroEnvio(null);
    setLinhas((prev) => {
      if (prev.length >= 100) return prev;
      const novoId = `linha-${proximoIdRef.current++}`;
      return [...prev, criarLinha(novoId)];
    });
  }, []);

  const removerLinha = useCallback((id: string) => {
    setErroEnvio(null);
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const { enviando, executar: executarEnviar } = useEnvio(async () => {
    const check = validarLinhasEntrada(linhas, mapaInsumos, observacao);
    if (!check.valido) {
      setTentouEnviar(true);
      return;
    }

    const itensResumo = check.itensPayload.map((it) => {
      const ins = mapaInsumos.get(it.insumoId);
      return {
        nome: ins?.nome ?? it.insumoId,
        quantidade: it.quantidade,
        unidade: ins?.unidade ?? 'un',
      };
    });

    const ok = await confirmar({
      titulo: 'Confirmar entrada manual',
      mensagem: textoConfirmacaoEntrada(itensResumo),
      textoConfirmar: 'Confirmar',
    });
    if (!ok) return;

    setErroEnvio(null);
    const conteudoAtual = chaveConteudoEntrada(observacao, check.itensPayload);
    if (!tentativaRef.current || tentativaRef.current.conteudo !== conteudoAtual) {
      tentativaRef.current = {
        conteudo: conteudoAtual,
        chave: gerarChaveIdempotencia(),
      };
    }

    const obsLimpa = observacao.trim();
    const insumosSelecionados = check.itensPayload.map((it) => ({
      id: it.insumoId,
      nome: mapaInsumos.get(it.insumoId)?.nome ?? it.insumoId,
    }));

    try {
      const resp = await api.post<RegistrarEntradaManualResultado>('/estoque/entradas-manuais', {
        chaveIdempotencia: tentativaRef.current.chave,
        ...(obsLimpa ? { observacao: obsLimpa } : {}),
        itens: check.itensPayload,
      });
      setResultado(resp.data);
      onSucesso?.();
      void recarregarInsumos();
    } catch (error) {
      const classificado = classificarErroEntrada(error, insumosSelecionados);
      if (classificado.tipo === 'conflito') {
        tentativaRef.current = null;
      }
      setErroEnvio(classificado);
    }
  });

  const lidarDarEntrada = useCallback(() => {
    if (!validacao.valido) {
      setTentouEnviar(true);
      return;
    }
    void executarEnviar();
  }, [validacao.valido, executarEnviar]);

  const formularioPreenchido = useMemo(
    () =>
      observacao.trim() !== '' ||
      linhas.some(
        (l) =>
          l.insumoId !== '' ||
          l.quantidadeTexto.trim() !== '' ||
          l.custoTexto.trim() !== '',
      ),
    [observacao, linhas],
  );

  const voltarAbertoRef = useRef(false);
  const lidarVoltar = useCallback(async () => {
    if (!formularioPreenchido) {
      onVoltar();
      return;
    }
    if (voltarAbertoRef.current) return;
    voltarAbertoRef.current = true;
    try {
      const ok = await confirmar({
        titulo: 'Descartar entrada manual',
        mensagem: 'Você preencheu dados nesta entrada. Deseja sair e descartar o preenchimento?',
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

  // Voltar do celular: na tela de resultado sai direto; no formulário, a mesma confirmação de descarte.
  useVoltarDoAparelho(true, () => (resultado ? onVoltar() : void lidarVoltar()));

  if (resultado) {
    return (
      <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink">
        <div className="px-4 pt-4 pb-2 space-y-2">
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <CheckCircle size={24} weight="fill" className="text-success shrink-0" />
            Entrada registrada
          </h1>
          {resultado.reaproveitado && (
            <p
              role="status"
              className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs font-semibold text-secondary"
            >
              Esta entrada já tinha sido registrada.
            </p>
          )}
        </div>

        <div className="px-4 pt-2 space-y-4 flex-1">
          {resultado.avisos.length > 0 && (
            <div
              role="alert"
              className="bg-primary-soft border border-brand/40 rounded-2xl p-3.5 space-y-1.5"
            >
              <p className="text-xs font-bold text-brand flex items-center gap-1.5">
                <Warning size={16} weight="fill" /> Atenção ao custo informado
              </p>
              <ul className="space-y-1 text-xs text-ink font-medium">
                {resultado.avisos.map((aviso, i) => (
                  <li key={i}>{aviso}</li>
                ))}
              </ul>
            </div>
          )}

          <section className="space-y-2" aria-label="Itens registrados">
            <h2 className="text-sm font-bold text-ink">Saldos atualizados</h2>
            <ul className="space-y-2">
              {resultado.itens.map((item) => {
                const sigla = siglaUnidadeBase(item.unidade);
                return (
                  <li
                    key={item.insumoId}
                    className="bg-card border border-line rounded-2xl px-3.5 py-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-ink min-w-0 break-words">
                        {item.nome}
                      </span>
                      <span className="text-xs font-bold text-success shrink-0">
                        +{formatarQuantidade(item.quantidade, sigla)}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      saldo {formatarQuantidade(item.saldoAnterior)} →{' '}
                      {formatarQuantidade(item.saldoPosterior)} {sigla}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <p className="bg-card-2 border border-line rounded-2xl px-3.5 py-2.5 text-xs text-muted">
            {AVISO_PERMANENTE}
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
    <div className="flex flex-col min-h-full pb-24 bg-canvas text-ink">
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
            <h1 className="text-xl font-bold text-ink leading-tight">Entrada manual</h1>
            <p className="text-xs text-muted">Compra sem nota fiscal (NF-e)</p>
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

        <div>
          <label
            htmlFor="entrada-manual-observacao"
            className="block text-xs font-semibold text-muted mb-1"
          >
            Observação (opcional)
          </label>
          <input
            id="entrada-manual-observacao"
            type="text"
            aria-label="Observação"
            maxLength={500}
            placeholder="Ex.: Nota perdida - Atacadão"
            value={observacao}
            onChange={(e) => {
              setErroEnvio(null);
              setObservacao(e.target.value);
            }}
            className="w-full bg-field border border-line rounded-2xl px-3 min-h-[44px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {errosExibidos.observacao && (
            <p className="text-xs text-danger font-semibold mt-1">{errosExibidos.observacao}</p>
          )}
        </div>

        {errosExibidos.geral && (
          <p
            role="status"
            className="bg-danger-soft border border-danger/40 text-danger rounded-2xl px-3 py-2 text-xs font-semibold"
          >
            {errosExibidos.geral}
          </p>
        )}

        <ul className="space-y-3">
          {linhas.map((linha, idx, todas) => {
            const numeroItem = idx + 1;
            const insumo = linha.insumoId ? mapaInsumos.get(linha.insumoId) : undefined;
            const alt = insumo ? unidadeAlternativa(insumo.unidade) : null;
            const siglaAtual = insumo
              ? linha.modoUnidade === 'ALTERNATIVA' && alt
                ? alt.siglaAlt
                : siglaUnidadeBase(insumo.unidade)
              : '';

            const idsUsadosEmOutrasLinhas = new Set(
              linhas
                .filter((outra) => outra.id !== linha.id && outra.insumoId)
                .map((outra) => outra.insumoId),
            );

            const termoLinha = normalizarBusca(linha.buscaInsumo);
            const bateComFiltro = (ins: InsumoParaEntrada) =>
              (linha.filtroCategoria === 'TODOS' || categoriaDoInsumo(ins) === linha.filtroCategoria) &&
              (!termoLinha || normalizarBusca(ins.nome).includes(termoLinha));
            // O <select> mantém o insumo já escolhido mesmo fora do filtro, para não sumir da caixa.
            const opcoesLinha = insumos.filter((ins) => ins.id === linha.insumoId || bateComFiltro(ins));
            // A lista visível mostra só o que bate com a busca/categoria (no celular o <select> fechado não muda).
            const mostrarResultados = termoLinha !== '' || linha.filtroCategoria !== 'TODOS';
            const encontrados = mostrarResultados ? insumos.filter(bateComFiltro) : [];
            const itemQueUsa = (insumoId: string) =>
              todas.findIndex((outra) => outra.id !== linha.id && outra.insumoId === insumoId) + 1;

            const qtdParsed = parsearQuantidadeEntrada(linha.quantidadeTexto);
            const equivalencia =
              insumo && qtdParsed !== null
                ? converterQuantidadeParaBase(qtdParsed, insumo.unidade, linha.modoUnidade)
                    .textoEquivalencia
                : null;

            const custoParsed = parsearCustoEntrada(linha.custoTexto);
            const textoConversaoCusto =
              insumo && custoParsed.valido
                ? converterCustoParaBase(custoParsed.valor, insumo.unidade, linha.modoUnidade)
                    .textoConversaoCusto
                : null;

            const erroLinha = errosExibidos.porLinha[linha.id];
            const erroQuantidade =
              erroLinha?.quantidade ??
              (PADRAO_MILHAR.test(linha.quantidadeTexto.trim()) ? MENSAGEM_ERRO_MILHAR : undefined);

            return (
              <li
                key={linha.id}
                aria-label={`Item ${numeroItem}`}
                className="bg-card border border-line rounded-3xl p-3.5 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Package size={15} className="text-brand" weight="duotone" />
                    Item {numeroItem}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remover item ${numeroItem}`}
                    onClick={() => removerLinha(linha.id)}
                    className="min-h-[44px] min-w-[44px] rounded-xl text-muted hover:text-danger hover:bg-danger-soft flex items-center justify-center cursor-pointer"
                  >
                    <Trash size={17} />
                  </button>
                </div>

                {/* Atalho por categoria e busca por nome */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Filtrar categoria do item ${numeroItem}`}>
                    {CATEGORIAS_FILTRO.map((cat) => {
                      const ativo = linha.filtroCategoria === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => atualizarLinha(linha.id, { filtroCategoria: cat.id })}
                          className={`min-h-[44px] px-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            ativo
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-field text-muted hover:text-ink border border-line'
                          }`}
                        >
                          {cat.rotulo}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <MagnifyingGlass
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                      type="search"
                      aria-label={`Buscar insumo do item ${numeroItem}`}
                      placeholder="Buscar insumo por nome..."
                      value={linha.buscaInsumo}
                      onChange={(e) => atualizarLinha(linha.id, { buscaInsumo: e.target.value })}
                      className="w-full bg-field border border-line rounded-2xl pl-9 pr-3 min-h-[44px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  {mostrarResultados && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted ml-1" aria-live="polite">
                        {encontrados.length === 0
                          ? 'Nenhum insumo encontrado'
                          : `${encontrados.length} ${encontrados.length === 1 ? 'encontrado' : 'encontrados'}`}
                      </p>
                      {encontrados.length > 0 && (
                        <ul
                          aria-label={`Resultados da busca do item ${numeroItem}`}
                          className="bg-card-2 border border-line rounded-2xl overflow-hidden divide-y divide-line"
                        >
                          {encontrados.slice(0, LIMITE_RESULTADOS_BUSCA).map((ins) => {
                            const usadoNoItem = idsUsadosEmOutrasLinhas.has(ins.id) ? itemQueUsa(ins.id) : 0;
                            return (
                              <li key={ins.id}>
                                <button
                                  type="button"
                                  disabled={usadoNoItem > 0}
                                  onClick={() =>
                                    atualizarLinha(linha.id, {
                                      insumoId: ins.id,
                                      modoUnidade: 'BASE',
                                      buscaInsumo: '',
                                      filtroCategoria: 'TODOS',
                                    })
                                  }
                                  className="w-full min-h-[44px] px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-field disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span className="min-w-0 break-words text-sm font-semibold text-ink">{ins.nome}</span>
                                  <span className="shrink-0 text-xs text-muted">
                                    {usadoNoItem > 0 ? `já está no item ${usadoNoItem}` : ins.unidade}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {encontrados.length > LIMITE_RESULTADOS_BUSCA && (
                        <p className="text-[11px] text-muted ml-1">
                          {`Mostrando ${LIMITE_RESULTADOS_BUSCA} de ${encontrados.length}. Digite mais do nome para filtrar.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Seletor de insumo */}
                <div>
                  <select
                    aria-label={`Insumo do item ${numeroItem}`}
                    value={linha.insumoId}
                    onChange={(e) =>
                      atualizarLinha(linha.id, {
                        insumoId: e.target.value,
                        modoUnidade: 'BASE',
                      })
                    }
                    className="w-full bg-field border border-line rounded-2xl px-3 min-h-[44px] text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Selecione um insumo...</option>
                    {opcoesLinha.map((ins) => (
                      <option
                        key={ins.id}
                        value={ins.id}
                        disabled={idsUsadosEmOutrasLinhas.has(ins.id)}
                      >
                        {ins.nome} ({ins.unidade})
                      </option>
                    ))}
                  </select>
                  {erroLinha?.insumoId && (
                    <p className="text-xs text-danger font-semibold mt-1">{erroLinha.insumoId}</p>
                  )}
                </div>

                {/* Unidade do insumo e alternância g/kg ou ml/L */}
                {insumo && (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs text-muted">
                      Unidade: <span className="font-semibold text-ink">{insumo.unidade}</span>
                    </p>
                    {alt && (
                      <div
                        className="inline-flex rounded-xl bg-field p-1 border border-line shrink-0 gap-1"
                        role="group"
                        aria-label={`Unidade de digitação do item ${numeroItem}`}
                      >
                        <button
                          type="button"
                          aria-pressed={linha.modoUnidade === 'BASE'}
                          aria-label={`Usar ${alt.siglaBase} no item ${numeroItem}`}
                          onClick={() => atualizarLinha(linha.id, { modoUnidade: 'BASE' })}
                          className={`min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            linha.modoUnidade === 'BASE'
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          {alt.siglaBase}
                        </button>
                        <button
                          type="button"
                          aria-pressed={linha.modoUnidade === 'ALTERNATIVA'}
                          aria-label={`Usar ${alt.siglaAlt} no item ${numeroItem}`}
                          onClick={() => atualizarLinha(linha.id, { modoUnidade: 'ALTERNATIVA' })}
                          className={`min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            linha.modoUnidade === 'ALTERNATIVA'
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          {alt.siglaAlt}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantidade e Custo unitário */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor={`qtd-item-${linha.id}`}
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Quantidade {siglaAtual ? `(${siglaAtual})` : ''}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`qtd-item-${linha.id}`}
                        type="text"
                        inputMode="decimal"
                        aria-label={`Quantidade do item ${numeroItem}`}
                        placeholder="0"
                        value={linha.quantidadeTexto}
                        onChange={(e) =>
                          atualizarLinha(linha.id, { quantidadeTexto: e.target.value })
                        }
                        className="w-full min-w-0 bg-field border border-line rounded-2xl px-3 min-h-[44px] text-sm font-semibold text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      {siglaAtual && (
                        <span className="shrink-0 px-2.5 min-h-[44px] rounded-2xl bg-card-2 border border-line text-xs font-bold text-ink flex items-center">
                          {siglaAtual}
                        </span>
                      )}
                    </div>
                    {equivalencia && (
                      <p className="text-xs font-semibold text-secondary mt-1">{equivalencia}</p>
                    )}
                    {erroQuantidade && (
                      <p className="text-xs text-danger font-semibold mt-1">
                        {erroQuantidade}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor={`custo-item-${linha.id}`}
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Custo unitário (opcional{siglaAtual ? `, R$/${siglaAtual}` : ''})
                    </label>
                    <input
                      id={`custo-item-${linha.id}`}
                      type="text"
                      inputMode="decimal"
                      aria-label={`Custo unitário do item ${numeroItem}`}
                      placeholder="Opcional"
                      value={linha.custoTexto}
                      onChange={(e) => atualizarLinha(linha.id, { custoTexto: e.target.value })}
                      className="w-full bg-field border border-line rounded-2xl px-3 min-h-[44px] text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    {insumo && (
                      <p className="text-[11px] text-muted mt-1">
                        Salvo em R$ por {insumo.unidade}
                      </p>
                    )}
                    {textoConversaoCusto && (
                      <p className="text-xs font-semibold text-secondary mt-0.5">
                        {textoConversaoCusto}
                      </p>
                    )}
                    {erroLinha?.custo && (
                      <p className="text-xs text-danger font-semibold mt-1">{erroLinha.custo}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={linhas.length >= 100}
          onClick={adicionarLinha}
          className="w-full bg-card border border-line hover:bg-card-2 disabled:opacity-50 text-ink rounded-2xl min-h-[44px] font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus size={18} weight="bold" /> Adicionar item
        </button>

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
          {AVISO_PERMANENTE}
        </p>

        <div className="sticky bottom-20 pt-1 z-20">
          <button
            type="button"
            disabled={enviando}
            onClick={lidarDarEntrada}
            className="w-full bg-primary hover:bg-primary-deep disabled:opacity-50 text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer shadow-primary"
          >
            {enviando ? 'Registrando…' : 'Dar entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}
