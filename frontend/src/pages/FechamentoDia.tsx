import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Minus, Plus, MagnifyingGlass, Warning, WarningCircle, CircleNotch } from '../components/ui/icons';
import { api, mensagemDeErro } from '../lib/api';
import { dataHojeNaLoja, dataPorExtenso, dataSugeridaFechamento, formatarQuantidade, normalizarBusca } from '../lib/formatar';
import {
  agruparImpacto,
  chaveSimulacao,
  filtrarProdutosVendaveis,
  itensParaSimulacao,
  classificarErroConfirmacao,
  fechamentosAtivos,
  limitarQuantidade,
  normalizarListagem,
  textoAvisoDiaJaFechado,
  resumoFechamento,
  textoConfirmacaoBaixa,
  type ConsumoSimulacao,
  type ErroConfirmacao,
  type ProdutoFechamento,
  type ResultadoConfirmacao,
  type ResultadoEstorno,
  type ResultadoSimulacao,
} from '../lib/fechamentoDia';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { useVoltarDoAparelho } from '../hooks/useVoltarDoAparelho';
import { useFeedback } from '../context/FeedbackContext';
import { gerarChaveIdempotencia } from '../lib/chaveIdempotencia';
import EstornoFechamentoSheet from '../components/EstornoFechamentoSheet';
import FechamentoConcluido from '../components/FechamentoConcluido';
import FechamentosDoDia from '../components/FechamentosDoDia';

interface Props {
  onVoltar: () => void;
}

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function LinhaImpacto({ c }: { c: ConsumoSimulacao }) {
  return (
    <li
      className={`rounded-2xl px-3 py-2 text-xs border ${
        c.ficariaNegativo ? 'bg-danger-soft border-danger/40' : 'bg-card border-line'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-ink min-w-0 break-words">{c.nome}</span>
        {c.ficariaNegativo && (
          <span className="shrink-0 text-danger font-bold flex items-center gap-1">
            <Warning size={14} weight="fill" /> ficaria negativo
          </span>
        )}
      </div>
      <p className="text-muted mt-0.5 break-words">
        consumo {formatarQuantidade(c.consumo, c.unidade)} · {formatarQuantidade(c.estoqueAtual, c.unidade)} →{' '}
        {formatarQuantidade(c.estoqueProjetado, c.unidade)}
      </p>
    </li>
  );
}

export default function FechamentoDia({ onVoltar }: Props) {
  const hoje = dataHojeNaLoja();
  // Depois da meia-noite (até as 5:59) a tela já sugere o dia anterior: a loja fecha depois das 23h.
  const [data, setData] = useState(() => dataSugeridaFechamento());
  const [busca, setBusca] = useState('');
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [impacto, setImpacto] = useState<{ chave: string; resultado: ResultadoSimulacao } | null>(null);
  const [erroSimulacao, setErroSimulacao] = useState<{ chave: string; mensagem: string } | null>(null);
  const secaoImpactoRef = useRef<HTMLElement | null>(null);
  const { confirmar } = useFeedback();
  const [erroConfirmacao, setErroConfirmacao] = useState<{ chave: string; erro: ErroConfirmacao } | null>(null);
  const [concluido, setConcluido] = useState<ResultadoConfirmacao | null>(null);
  const [estorno, setEstorno] = useState<ResultadoEstorno | null>(null);
  const [jaEstornado, setJaEstornado] = useState(false);
  const [estornoAberto, setEstornoAberto] = useState(false);
  // Uma chave por tentativa: reenviar (falha de rede, 5xx) reaproveita a mesma; mudar itens, quantidades ou data troca.
  const tentativaRef = useRef<{ conteudo: string; chave: string } | null>(null);

  const buscarProdutos = useCallback(() => api.get<ProdutoFechamento[]>('/produtos').then((r) => r.data), []);
  const { dados, carregandoInicial, erro, tentarNovamente } = useCarregamento(buscarProdutos, [], {
    mensagemPadrao: 'Não foi possível carregar os produtos.',
  });

  const dataValida = DATA_VALIDA.test(data) && data <= hoje;
  const buscarLista = useCallback(
    () =>
      api.get(`/vendas/fechamentos-manuais?data=${data}`).then((r) => {
        const listagem = normalizarListagem(r.data);
        if (!listagem) throw new Error('Resposta inesperada da lista de fechamentos.');
        return listagem;
      }),
    [data],
  );
  const {
    dados: lista,
    carregandoInicial: carregandoLista,
    erro: erroLista,
    recarregar: recarregarLista,
    tentarNovamente: tentarNovamenteLista,
  } = useCarregamento(buscarLista, [data], {
    habilitado: dataValida,
    mensagemPadrao: 'Não foi possível carregar os lançamentos do dia.',
  });
  const avisoDiaJaFechado = textoAvisoDiaJaFechado(fechamentosAtivos(lista?.fechamentos ?? []));

  const produtos = useMemo(() => filtrarProdutosVendaveis(dados ?? []), [dados]);
  const termo = normalizarBusca(busca);
  const visiveis = produtos.filter((p) => !termo || normalizarBusca(p.nome).includes(termo));

  const dataFutura = DATA_VALIDA.test(data) && data > hoje;
  const resumo = resumoFechamento(quantidades);
  const chaveAtual = chaveSimulacao(data, quantidades);
  const obsoleto = impacto !== null && impacto.chave !== chaveAtual;
  // O erro vale só para o que foi simulado: se a pessoa mudou algo, ele deixa de se aplicar.
  const mensagemErro = erroSimulacao && erroSimulacao.chave === chaveAtual ? erroSimulacao.mensagem : null;
  const ocultosComQuantidade = termo ? produtos.filter((p) => (quantidades[p.id] ?? 0) > 0 && !visiveis.includes(p)).length : 0;

  const definirQuantidade = (id: string, valor: unknown) =>
    setQuantidades((anterior) => ({ ...anterior, [id]: limitarQuantidade(valor) }));

  const { enviando, executar } = useEnvio(async () => {
    setErroSimulacao(null);
    const chaveEnviada = chaveAtual;
    try {
      const resp = await api.post<ResultadoSimulacao>('/vendas/fechamento-manual/simulacao', {
        data,
        itens: itensParaSimulacao(quantidades),
      });
      setImpacto({ chave: chaveEnviada, resultado: resp.data });
    } catch (error) {
      setErroSimulacao({ chave: chaveEnviada, mensagem: mensagemDeErro(error, 'Não foi possível simular o impacto no estoque.') });
    }
  });

  const erroConfirmacaoAtual = erroConfirmacao && erroConfirmacao.chave === chaveAtual ? erroConfirmacao.erro : null;

  const { enviando: confirmando, executar: executarConfirmacao } = useEnvio(async () => {
    if (!impacto) return;
    const ok = await confirmar({
      titulo: 'Confirmar baixa',
      mensagem: textoConfirmacaoBaixa(resumo.unidades, data, impacto.resultado.temNegativo),
      textoConfirmar: 'Dar baixa',
      perigoso: impacto.resultado.temNegativo,
    });
    if (!ok) return;
    setErroConfirmacao(null);
    const chaveEnviada = chaveAtual;
    if (!tentativaRef.current || tentativaRef.current.conteudo !== chaveEnviada) {
      tentativaRef.current = { conteudo: chaveEnviada, chave: gerarChaveIdempotencia() };
    }
    try {
      const resp = await api.post<ResultadoConfirmacao>('/vendas/fechamento-manual', {
        chaveIdempotencia: tentativaRef.current.chave,
        data,
        itens: itensParaSimulacao(quantidades),
      });
      setConcluido(resp.data);
      void recarregarLista();
    } catch (error) {
      const classificado = classificarErroConfirmacao(error);
      if (classificado.tipo === 'conflito') tentativaRef.current = null;
      setErroConfirmacao({ chave: chaveEnviada, erro: classificado });
    }
  });

  // Quando o resultado chega, leva a pessoa até ele (fica abaixo da lista) e avisa o leitor de tela pelo foco.
  const resultadoChave = impacto?.resultado;
  useEffect(() => {
    if (!resultadoChave) return;
    secaoImpactoRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    secaoImpactoRef.current?.focus({ preventScroll: true });
  }, [resultadoChave]);

  // O mesmo fechamento pode ser estornado pela lista abaixo; a tela de resultado acompanha.
  const estornadoNaLista = concluido
    ? (lista?.fechamentos ?? []).some((f) => f.id === concluido.vendaId && f.estornada)
    : false;

  const blocoLista = dataValida ? (
    <FechamentosDoDia
      dados={lista}
      carregando={carregandoLista}
      erro={erroLista ? erroLista.mensagem : null}
      onTentarNovamente={tentarNovamenteLista}
      onAlterado={() => void recarregarLista()}
    />
  ) : null;

  const podeSimular = resumo.produtos > 0 && dataValida && !enviando && !confirmando;
  const podeConfirmar = impacto !== null && !obsoleto && impacto.resultado.podeConfirmar && !confirmando;
  const resultado = impacto?.resultado ?? null;
  const agrupado = resultado ? agruparImpacto(resultado.consumos) : null;

  useVoltarDoAparelho(true, onVoltar);

  if (concluido) {
    return (
      <>
        <FechamentoConcluido
          resultado={concluido}
          estorno={estorno}
          jaEstornado={jaEstornado || estornadoNaLista}
          onDesfazer={() => setEstornoAberto(true)}
          onConcluir={onVoltar}
        />
        <EstornoFechamentoSheet
          aberto={estornoAberto}
          vendaId={concluido.vendaId}
          onFechar={() => setEstornoAberto(false)}
          onEstornado={(r) => {
            setEstorno(r);
            void recarregarLista();
          }}
          onJaEstornado={() => {
            setJaEstornado(true);
            void recarregarLista();
          }}
        />
        <div className="px-4 pb-32 max-w-md mx-auto">{blocoLista}</div>
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-40 bg-canvas text-ink">
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
          <h1 className="text-xl font-bold text-ink leading-tight">Fechar o dia</h1>
        </div>

        <div>
          <label htmlFor="fechamento-data" className="block text-xs font-semibold text-muted mb-1">
            Dia das vendas
          </label>
          <input
            id="fechamento-data"
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => setData(e.target.value)}
            className="w-full bg-field border border-line rounded-2xl px-3 min-h-[44px] text-ink"
          />
          {dataFutura && <p className="text-xs text-danger font-semibold mt-1">A data não pode ser futura.</p>}
          {dataValida && (
            <p className="text-xs text-muted mt-1">Vendas de {dataPorExtenso(new Date(`${data}T12:00:00-04:00`))}</p>
          )}
        </div>

        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            aria-label="Buscar produto"
            placeholder="Buscar produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-field border border-line rounded-2xl pl-9 pr-3 min-h-[44px] text-ink"
          />
        </div>
        {ocultosComQuantidade > 0 && (
          <p className="text-xs text-secondary font-semibold">
            {ocultosComQuantidade} {ocultosComQuantidade === 1 ? 'produto' : 'produtos'} com quantidade fora da busca
          </p>
        )}
      </div>

      <div className="px-4 pt-2 space-y-4">
        {avisoDiaJaFechado && (
          <p role="status" className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs font-semibold text-secondary">
            {avisoDiaJaFechado}
          </p>
        )}

        {blocoLista}

        {erro && (
          <div role="alert" className="bg-danger-soft border border-danger/40 text-danger p-3.5 rounded-xl text-xs flex gap-2 items-center">
            <WarningCircle size={18} className="shrink-0" />
            <p className="flex-1 font-semibold">{erro.mensagem}</p>
            <button
              type="button"
              onClick={tentarNovamente}
              className="shrink-0 min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink font-bold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {carregandoInicial && !erro && (
          <p className="text-sm text-muted flex items-center gap-2">
            <CircleNotch size={16} className="animate-spin" /> Carregando produtos…
          </p>
        )}

        {!carregandoInicial && !erro && visiveis.length === 0 && (
          <p className="text-sm text-muted">Nenhum produto encontrado.</p>
        )}

        <ul className="space-y-2">
          {visiveis.map((p) => {
            const q = quantidades[p.id] ?? 0;
            return (
              <li
                key={p.id}
                className={`rounded-2xl border px-3 py-2 flex items-center gap-2 ${
                  q > 0 ? 'bg-primary-soft border-brand' : 'bg-card border-line'
                }`}
              >
                <span className="flex-1 min-w-0 font-semibold text-ink break-words">{p.nome}</span>
                <button
                  type="button"
                  aria-label={`Diminuir ${p.nome}`}
                  onClick={() => definirQuantidade(p.id, q - 1)}
                  className="min-h-[44px] min-w-[44px] rounded-full bg-field text-ink flex items-center justify-center cursor-pointer"
                >
                  <Minus size={18} weight="bold" />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Quantidade de ${p.nome}`}
                  placeholder="0"
                  value={q > 0 ? String(q) : ''}
                  onChange={(e) => definirQuantidade(p.id, e.target.value)}
                  className="w-14 text-center bg-field border border-line rounded-xl min-h-[44px] font-bold text-ink"
                />
                <button
                  type="button"
                  aria-label={`Aumentar ${p.nome}`}
                  onClick={() => definirQuantidade(p.id, q + 1)}
                  className="min-h-[44px] min-w-[44px] rounded-full bg-primary text-on-primary flex items-center justify-center cursor-pointer"
                >
                  <Plus size={18} weight="bold" />
                </button>
              </li>
            );
          })}
        </ul>

        {mensagemErro && (
          <div role="alert" className="bg-danger-soft border border-danger/40 text-danger p-3.5 rounded-xl text-xs font-semibold">
            {mensagemErro}
          </div>
        )}

        {resultado && agrupado && (
          <section
            ref={secaoImpactoRef}
            tabIndex={-1}
            aria-label="Impacto no estoque"
            className="space-y-3 scroll-mt-44 outline-none"
          >
            {obsoleto && (
              <p role="status" className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs font-semibold text-secondary">
                Atualize o impacto
              </p>
            )}

            {resultado.produtosSemFicha.length > 0 && (
              <p role="alert" className="bg-danger-soft border border-danger/40 text-danger rounded-2xl px-3 py-2 text-xs font-semibold">
                Estes produtos não têm ficha técnica e impedem a baixa:{' '}
                {resultado.produtosSemFicha.map((p) => p.nome).join(', ')}.
              </p>
            )}

            <div className={obsoleto ? 'opacity-60 space-y-3' : 'space-y-3'}>
              {agrupado.negativos.length > 0 && (
                <div className="space-y-1.5">
                  <h2 className="text-sm font-bold text-danger">Ficariam negativos</h2>
                  <ul className="space-y-1.5">
                    {agrupado.negativos.map((c) => (
                      <LinhaImpacto key={c.insumoId} c={c} />
                    ))}
                  </ul>
                </div>
              )}
              {agrupado.grupos.map((g) => (
                <div key={g.categoria} className="space-y-1.5">
                  <h2 className="text-sm font-bold text-ink">{g.rotulo}</h2>
                  <ul className="space-y-1.5">
                    {g.itens.map((c) => (
                      <LinhaImpacto key={c.insumoId} c={c} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {erroConfirmacaoAtual && (
              <p role="alert" className="bg-danger-soft border border-danger/40 text-danger rounded-2xl px-3 py-2 text-xs font-semibold">
                {erroConfirmacaoAtual.tipo === 'rede' &&
                  'Não foi possível confirmar. Toque em Tentar novamente: nada será baixado em dobro.'}
                {erroConfirmacaoAtual.tipo === 'conflito' &&
                  'Esta tentativa já foi usada com outro conteúdo. Confira a lista do dia antes de tentar de novo.'}
                {erroConfirmacaoAtual.tipo === 'validacao' &&
                  [
                    erroConfirmacaoAtual.mensagem,
                    erroConfirmacaoAtual.produtosSemFicha.length > 0 &&
                      `Sem ficha técnica: ${erroConfirmacaoAtual.produtosSemFicha.join(', ')}.`,
                    erroConfirmacaoAtual.produtosNaoEncontrados.length > 0 &&
                      `Não encontrados: ${erroConfirmacaoAtual.produtosNaoEncontrados.join(', ')}.`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                {erroConfirmacaoAtual.tipo === 'outro' && erroConfirmacaoAtual.mensagem}
              </p>
            )}

            <button
              type="button"
              disabled={!podeConfirmar}
              onClick={() => void executarConfirmacao()}
              className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirmando ? 'Confirmando…' : erroConfirmacaoAtual?.tipo === 'rede' ? 'Tentar novamente' : 'Confirmar baixa'}
            </button>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-canvas border-t border-line px-4 py-3 space-y-2 z-20">
        <p className="text-sm font-semibold text-ink">
          {resumo.produtos} {resumo.produtos === 1 ? 'produto' : 'produtos'} · {resumo.unidades}{' '}
          {resumo.unidades === 1 ? 'unidade' : 'unidades'}
        </p>
        <button
          type="button"
          disabled={!podeSimular}
          onClick={() => void executar()}
          className="w-full bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Calculando…' : 'Ver impacto no estoque'}
        </button>
      </div>
    </div>
  );
}
