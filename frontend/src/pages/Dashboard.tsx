import { useCallback, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowsClockwise,
  Truck,
  Scales,
  Warning,
  Hamburger,
  Package,
  CheckCircle,
  CircleNotch,
  CalendarBlank,
} from '../components/ui/icons';
import Smash from '../components/brand/Smash';
import { api } from '../lib/api';
import { useCarregamento } from '../hooks/useCarregamento';
import { useEnvio } from '../hooks/useEnvio';
import { formatarMoeda, formatarQuantidade, formatarPercentual } from '../lib/formatar';
import { stagger, rise, tap } from '../lib/motion';
import { validarPeriodo, hojeNaLoja, inicioDoMesNaLoja, diaPorExtensoCurto } from './periodoPersonalizado';
import { ordenarAlertas, tipoAlerta, textoAlertaValidade, listaOuVazia, type AlertaEstoque } from './alertasEstoque';

interface Kpis {
  totalVendasValor: number;
  totalVendasQtd: number;
  totalComprasValor: number;
  totalComprasQtd: number;
  totalPerdasValor: number;
  totalPerdasQtd: number;
  insumosEmAlertaQtd: number;
}

interface PerdaMotivo {
  motivo: string;
  label: string;
  valorTotal: number;
  quantidadeTotal: number;
  totalOcorrencias: number;
  percentual: number;
}

interface ConsumoInsumo {
  insumoId: string;
  nome: string;
  unidade: string;
  quantidadeConsumida: number;
  valorEstimado: number;
}

interface ItemMaisVendido {
  produtoNome: string;
  quantidadeVendida: number;
  valorEstimadoTotal: number;
}

interface ComprasFornecedor {
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorTotal: number;
  totalNotas: number;
  percentual: number;
}

interface ResumoDashboard {
  periodo: { tipo: string; dataInicio: string; dataFim: string };
  kpis: Kpis;
  perdasPorMotivo: PerdaMotivo[];
  consumoInsumos: ConsumoInsumo[];
  itensMaisVendidos: ItemMaisVendido[];
  estoqueAlerta: AlertaEstoque[];
  comprasPorFornecedor: ComprasFornecedor[];
}

type Periodo = 'hoje' | 'semana' | 'mes';

/** Filtro aplicado: um período fixo ou um intervalo `yyyy-mm-dd` já validado. */
type Filtro = { tipo: Periodo } | { tipo: 'personalizado'; dataInicio: string; dataFim: string };

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes', label: 'Mês' },
];

/** Cor da barra por motivo de perda (mesma família dos botões da tela de Perdas). */
const COR_MOTIVO: Record<string, string> = {
  VENCIMENTO: 'bg-danger',
  ERRO_PREPARO: 'bg-primary',
  ESTRAGADO: 'bg-danger',
  OUTRO: 'bg-muted',
};

/** "1 pedido", "1.206 pedidos" (pt-BR). */
function contagem(qtd: number, singular: string, plural: string): string {
  return `${formatarQuantidade(qtd)} ${qtd === 1 ? singular : plural}`;
}

/** Texto do chip de um alerta: prazo de validade, "Sem estoque" ou "% do mínimo". */
function textoChipAlerta(a: AlertaEstoque): string {
  if (tipoAlerta(a) !== 'estoque') return textoAlertaValidade(a);
  // Com estoque zerado ou negativo o percentual engana: mínimo 0 vira "100%" no backend e negativo vira "-40%"
  if (a.estoqueAtual <= 0) return 'Sem estoque';
  return `${formatarPercentual(a.percentualEstoque, true)} do mínimo`;
}

function Barra({ valor, maximo, cor }: { valor: number; maximo: number; cor: string }) {
  // Valor zero ou negativo não desenha barra; positivo pequeno ganha 3% para continuar visível
  const largura = maximo > 0 && valor > 0 ? Math.max(3, (valor / maximo) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-card-2 overflow-hidden mt-1">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <motion.section variants={rise} className="bg-card border border-line rounded-3xl px-4 py-3">
      <h2 className="font-semibold text-ink">{titulo}</h2>
      {subtitulo && <p className="text-xs text-muted mb-1.5">{subtitulo}</p>}
      {children}
    </motion.section>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted py-1">{texto}</p>;
}

export default function Dashboard() {
  const [filtro, setFiltro] = useState<Filtro>({ tipo: 'mes' });
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => inicioDoMesNaLoja());
  const [dataFim, setDataFim] = useState(() => hojeNaLoja());
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);

  // Chave primitiva do filtro: trocar de período reinicia a carga e descarta a resposta do anterior
  const chaveFiltro = filtro.tipo === 'personalizado' ? `${filtro.dataInicio}|${filtro.dataFim}` : filtro.tipo;

  const buscar = useCallback(
    () =>
      api.get<ResumoDashboard>('/dashboard/resumo', {
        params: filtro.tipo === 'personalizado' ? { dataInicio: filtro.dataInicio, dataFim: filtro.dataFim } : { periodo: filtro.tipo },
      }).then((r) => {
        // 200 sem o objeto esperado (ex.: index.html devolvido por um proxy) vira erro de carga com mensagem
        if (!r.data || typeof r.data !== 'object' || !r.data.kpis || typeof r.data.kpis !== 'object') {
          throw new Error('Resposta inesperada do servidor.');
        }
        return r.data;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chaveFiltro resume o filtro inteiro
    [chaveFiltro],
  );
  const { dados, carregandoInicial, erro, erroRecarga, recarregar, tentarNovamente } = useCarregamento(
    buscar,
    [chaveFiltro],
    { mensagemPadrao: 'Não foi possível carregar os relatórios.' },
  );
  // Trava síncrona: o botão do cabeçalho e o "Tentar novamente" do aviso não disparam duas recargas
  const { enviando: atualizando, executar: atualizar } = useEnvio(recarregar);

  const aplicarPeriodo = (evento: React.FormEvent) => {
    evento.preventDefault();
    const problema = validarPeriodo(dataInicio, dataFim);
    setErroPeriodo(problema);
    if (problema) return;
    setFiltro({ tipo: 'personalizado', dataInicio, dataFim });
    setEditandoPeriodo(false);
  };

  const escolherPeriodo = (id: Periodo) => {
    setFiltro({ tipo: id });
    setEditandoPeriodo(false);
    setErroPeriodo(null);
  };

  const k = dados?.kpis;
  const percentualPerdas = k && k.totalComprasValor > 0 ? k.totalPerdasValor / k.totalComprasValor : null;
  // O backend manda sempre os 4 motivos, zerados quando não houve perda (dashboard.service.ts:197-236)
  const perdasMotivo = listaOuVazia<PerdaMotivo>(dados?.perdasPorMotivo).filter((p) => p.totalOcorrencias > 0 || p.valorTotal > 0);
  const compras = listaOuVazia<ComprasFornecedor>(dados?.comprasPorFornecedor);
  const alertas = ordenarAlertas(listaOuVazia<AlertaEstoque>(dados?.estoqueAlerta));
  const maxPerda = Math.max(0, ...perdasMotivo.map((p) => p.valorTotal));
  const maxCompra = Math.max(0, ...compras.map((c) => c.valorTotal));
  const maisVendidos = listaOuVazia<ItemMaisVendido>(dados?.itensMaisVendidos).slice(0, 5);
  const maxVendido = Math.max(0, ...maisVendidos.map((i) => i.quantidadeVendida));
  const consumo = [...listaOuVazia<ConsumoInsumo>(dados?.consumoInsumos)].sort((a, b) => b.valorEstimado - a.valorEstimado).slice(0, 5);
  const maxConsumo = Math.max(0, ...consumo.map((c) => c.valorEstimado));

  return (
    <div className="px-4 pt-4 pb-24 space-y-3 text-ink">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Relatórios</h1>
        <motion.button
          type="button"
          whileTap={tap}
          onClick={() => void atualizar()}
          disabled={carregandoInicial || atualizando}
          aria-label="Atualizar relatórios"
          className="w-11 h-11 rounded-2xl text-muted hover:text-ink flex items-center justify-center cursor-pointer"
        >
          <ArrowsClockwise size={20} className={atualizando ? 'animate-spin' : ''} />
        </motion.button>
      </div>

      {/* Período */}
      <div role="tablist" aria-label="Período" className="flex bg-field rounded-2xl p-1 gap-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={filtro.tipo === p.id}
            onClick={() => escolherPeriodo(p.id)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold cursor-pointer min-h-[44px] transition-colors ${
              filtro.tipo === p.id ? 'bg-card text-ink shadow-sm' : 'text-muted'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={filtro.tipo === 'personalizado'}
          aria-expanded={editandoPeriodo}
          aria-controls="periodo-personalizado"
          aria-label="Período personalizado"
          onClick={() => setEditandoPeriodo((aberto) => !aberto)}
          className={`rounded-xl px-3 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
            filtro.tipo === 'personalizado' ? 'bg-card text-ink shadow-sm' : 'text-muted'
          }`}
        >
          <CalendarBlank size={16} weight="bold" />
        </button>
      </div>

      {filtro.tipo === 'personalizado' && !editandoPeriodo && (
        <p className="text-xs text-muted flex items-center gap-1">
          <CalendarBlank size={13} /> {diaPorExtensoCurto(filtro.dataInicio)} a {diaPorExtensoCurto(filtro.dataFim)}
        </p>
      )}

      {editandoPeriodo && (
        <form
          id="periodo-personalizado"
          onSubmit={aplicarPeriodo}
          noValidate
          className="bg-card border border-line rounded-3xl px-4 py-3 space-y-2"
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted flex flex-col gap-1">
              De
              <input
                type="date"
                value={dataInicio}
                max={dataFim || undefined}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-field text-ink rounded-xl px-2 min-h-[44px] text-sm"
              />
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Até
              <input
                type="date"
                value={dataFim}
                min={dataInicio || undefined}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-field text-ink rounded-xl px-2 min-h-[44px] text-sm"
              />
            </label>
          </div>
          {erroPeriodo && (
            <p role="alert" className="text-xs text-danger">
              {erroPeriodo}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEditandoPeriodo(false);
                setErroPeriodo(null);
              }}
              className="flex-1 rounded-2xl min-h-[44px] text-sm font-semibold text-muted border border-line cursor-pointer"
            >
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-2xl min-h-[44px] text-sm font-semibold bg-primary text-on-primary cursor-pointer">
              Aplicar
            </button>
          </div>
          <p className="text-[11px] text-muted">Até 366 dias.</p>
        </form>
      )}

      {erroRecarga && (
        <div role="alert" className="bg-danger-soft text-danger rounded-2xl p-3 text-xs flex items-center justify-between gap-2">
          <span>{erroRecarga}</span>
          <button
            type="button"
            onClick={() => void atualizar()}
            disabled={atualizando}
            className="font-bold underline cursor-pointer min-h-[44px] px-2 shrink-0 disabled:opacity-60"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {carregandoInicial ? (
        <div role="status" className="flex flex-col items-center justify-center py-16 text-muted">
          <CircleNotch className="animate-spin mb-2" size={30} />
          <p className="text-sm">Juntando os números do período…</p>
        </div>
      ) : erro || !dados || !k ? (
        <div className="flex flex-col items-center text-center py-10">
          <Smash mood="alert" size={96} />
          <p className="font-semibold mt-2">Não consegui carregar os relatórios</p>
          <p className="text-sm text-muted mb-4">{erro?.mensagem}</p>
          <motion.button
            type="button"
            whileTap={tap}
            onClick={tentarNovamente}
            className="bg-primary text-on-primary rounded-2xl px-5 font-semibold min-h-[46px] cursor-pointer"
          >
            Tentar novamente
          </motion.button>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
          {/* KPIs */}
          <motion.div variants={rise} className="grid grid-cols-2 gap-2">
            {[
              { titulo: 'Pedidos', valor: formatarQuantidade(k.totalVendasQtd), sub: k.totalVendasQtd === 1 ? 'pedido' : 'pedidos', icone: <Hamburger size={15} weight="duotone" className="text-ink" /> },
              { titulo: 'Compras', valor: formatarMoeda(k.totalComprasValor), sub: contagem(k.totalComprasQtd, 'nota', 'notas'), icone: <Truck size={15} weight="duotone" className="text-secondary" /> },
              {
                titulo: 'Perdas',
                valor: formatarMoeda(k.totalPerdasValor),
                sub: percentualPerdas === null ? contagem(k.totalPerdasQtd, 'registro', 'registros') : `${formatarPercentual(percentualPerdas)} das compras`,
                icone: <Scales size={15} weight="duotone" className="text-danger" />,
              },
              { titulo: 'Em alerta', valor: formatarQuantidade(k.insumosEmAlertaQtd), sub: k.insumosEmAlertaQtd === 1 ? 'insumo' : 'insumos', icone: <Warning size={15} weight="duotone" className="text-brand" /> },
            ].map((c) => (
              <div key={c.titulo} className="bg-card border border-line rounded-3xl p-3">
                <p className="text-xs text-muted flex items-center gap-1">
                  {c.icone} {c.titulo}
                </p>
                <p className="text-lg font-bold mt-0.5 truncate">{c.valor}</p>
                <p className="text-[11px] text-muted">{c.sub}</p>
              </div>
            ))}
          </motion.div>

          <Secao titulo="Onde o dinheiro está indo embora?" subtitulo="Perdas por motivo">
            {perdasMotivo.length === 0 ? (
              <Vazio texto="Nenhuma perda no período." />
            ) : (
              perdasMotivo.map((p) => (
                <div key={p.motivo} className="py-1">
                  <div className="flex justify-between text-xs">
                    <span>
                      {p.label} <span className="text-muted">· {formatarQuantidade(p.totalOcorrencias)}</span>
                    </span>
                    <strong>{formatarMoeda(p.valorTotal)}</strong>
                  </div>
                  <Barra valor={p.valorTotal} maximo={maxPerda} cor={COR_MOTIVO[p.motivo] ?? 'bg-muted'} />
                </div>
              ))
            )}
          </Secao>

          <Secao titulo="De onde vem o maior custo?" subtitulo="Compras por fornecedor">
            {compras.length === 0 ? (
              <Vazio texto="Nenhuma nota fiscal no período." />
            ) : (
              compras.slice(0, 5).map((c) => (
                <div key={c.fornecedorCnpj || c.fornecedorNome} className="py-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 line-clamp-2 break-words">{c.fornecedorNome}</span>
                    <strong className="shrink-0">{formatarMoeda(c.valorTotal)}</strong>
                  </div>
                  <Barra valor={c.valorTotal} maximo={maxCompra} cor="bg-secondary" />
                </div>
              ))
            )}
          </Secao>

          <Secao titulo="O que está para faltar?">
            {alertas.length === 0 ? (
              <p className="text-sm text-success flex items-center gap-1.5 py-1">
                <CheckCircle size={18} weight="fill" /> Nenhum insumo abaixo do mínimo ou vencido.
              </p>
            ) : (
              alertas.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-2 py-2 border-t border-line first:border-t-0 text-sm">
                  <span className="flex-1 min-w-0 line-clamp-2 break-words">{a.nome}</span>
                  {/* diasRestantesValidade só vem quando a validade é o motivo do alerta (vencido ou vencendo) */}
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      tipoAlerta(a) === 'vencendo' ? 'bg-primary-soft text-brand' : 'bg-danger-soft text-danger'
                    }`}
                  >
                    {textoChipAlerta(a)}
                  </span>
                </div>
              ))
            )}
          </Secao>

          <Secao titulo="Mais vendidos">
            {maisVendidos.length === 0 ? (
              <Vazio texto="Nenhuma venda no período." />
            ) : (
              maisVendidos.map((i, n) => (
                <div key={i.produtoNome} className="py-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <span className="text-muted mr-1">{n + 1}</span>
                      <Hamburger size={12} className="inline text-brand mr-1" />
                      {i.produtoNome}
                    </span>
                    <strong className="shrink-0">{formatarQuantidade(i.quantidadeVendida, 'un')}</strong>
                  </div>
                  <Barra valor={i.quantidadeVendida} maximo={maxVendido} cor="bg-primary" />
                </div>
              ))
            )}
          </Secao>

          <Secao titulo="O que a cozinha mais consumiu" subtitulo="Custo estimado pelas fichas técnicas">
            {consumo.length === 0 ? (
              <Vazio texto="Sem consumo calculado no período." />
            ) : (
              consumo.map((c) => (
                <div key={c.insumoId} className="py-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">
                      <Package size={12} className="inline text-muted mr-1" />
                      {c.nome} <span className="text-muted">· {formatarQuantidade(c.quantidadeConsumida, c.unidade)}</span>
                    </span>
                    <strong className="shrink-0">{formatarMoeda(c.valorEstimado)}</strong>
                  </div>
                  <Barra valor={c.valorEstimado} maximo={maxConsumo} cor="bg-ink" />
                </div>
              ))
            )}
          </Secao>
        </motion.div>
      )}
    </div>
  );
}
