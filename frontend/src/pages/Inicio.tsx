import { useCallback } from 'react';
import { motion } from 'motion/react';
import {
  QrCode,
  Scales,
  CalendarBlank,
  GearSix,
  Receipt,
  Hamburger,
  Warning,
  Thermometer,
  TrendDown,
  CheckCircle,
  CaretRight,
} from '../components/ui/icons';
import Smash from '../components/brand/Smash';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCarregamento } from '../hooks/useCarregamento';
import { formatarMoeda, formatarQuantidade, saudacao, dataPorExtenso } from '../lib/formatar';
import { stagger, rise, tap } from '../lib/motion';

interface KpisHoje {
  totalVendasValor: number;
  totalVendasQtd: number;
  totalComprasValor: number;
  totalComprasQtd: number;
  totalPerdasValor: number;
  totalPerdasQtd: number;
  insumosEmAlertaQtd: number;
}

interface InsumoAlerta {
  id: string;
  nome: string;
  unidade: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  status: 'CRITICO' | 'ALERTA';
  percentualEstoque: number;
  diasRestantesValidade?: number;
  vencido?: boolean;
}

interface DadosHoje {
  kpis: KpisHoje;
  estoqueAlerta: InsumoAlerta[];
  itensMaisVendidos: Array<{ produtoNome: string; quantidadeVendida: number }>;
}

interface Props {
  onNavegar: (aba: string) => void;
  onAbrirImportarNota: () => void;
  onAbrirPerfil?: () => void;
  onAbrirConfiguracoes?: () => void;
}

function iniciais(nome?: string) {
  return (nome || 'Operador')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function Inicio({ onNavegar, onAbrirImportarNota, onAbrirPerfil, onAbrirConfiguracoes }: Props) {
  const { usuario } = useAuth();

  const buscar = useCallback(
    () => api.get<DadosHoje>('/dashboard/resumo', { params: { periodo: 'hoje' } }).then((r) => r.data),
    [],
  );
  const { dados, carregandoInicial, erro, tentarNovamente } = useCarregamento(buscar, [], {
    mensagemPadrao: 'Não foi possível carregar o resumo de hoje.',
  });

  const alertas = dados?.estoqueAlerta ?? [];
  const maisVendidos = (dados?.itensMaisVendidos ?? []).slice(0, 3);
  const maiorVenda = Math.max(1, ...maisVendidos.map((i) => i.quantidadeVendida));
  const primeiroNome = usuario?.nome?.split(' ')[0];

  // O Smash resume o dia: preocupado com alertas, feliz quando está tudo em dia
  const fala = carregandoInicial
    ? 'Carregando o resumo de hoje…'
    : erro
      ? 'Não consegui carregar o resumo de hoje.'
      : alertas.length > 0
        ? `${alertas.length} ${alertas.length === 1 ? 'insumo pede' : 'insumos pedem'} atenção.`
        : 'Tudo em dia. Bom serviço!';
  const humor = carregandoInicial ? 'idle' : erro || alertas.length > 0 ? 'alert' : 'happy';

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="px-4 pt-4 pb-24 space-y-3 text-ink">
      {/* Saudação, Configurações e Perfil (só aqui: as outras telas não têm cabeçalho global) */}
      <motion.div variants={rise} className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted flex items-center gap-1">
            <CalendarBlank size={13} /> {dataPorExtenso()}
          </p>
          <h1 className="text-xl font-bold text-ink truncate">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onAbrirConfiguracoes}
            aria-label="Configurações"
            className="w-11 h-11 rounded-full border border-line text-muted hover:text-ink flex items-center justify-center cursor-pointer"
          >
            <GearSix size={20} />
          </motion.button>
          <motion.button
            type="button"
            whileTap={tap}
            onClick={onAbrirPerfil}
            aria-label={`Perfil de ${usuario?.nome || 'usuário'}`}
            className="w-11 h-11 rounded-full bg-primary-soft text-brand font-bold flex items-center justify-center cursor-pointer"
          >
            {iniciais(usuario?.nome)}
          </motion.button>
        </div>
      </motion.div>

      {/* Smash com o resumo do dia */}
      <motion.div variants={rise} className="flex items-center gap-1.5">
        <Smash mood={humor} size={74} />
        <div className="bg-card border border-line rounded-2xl px-3 py-2.5 text-sm leading-snug">
          {fala}
          {erro && (
            <button
              type="button"
              onClick={tentarNovamente}
              className="block mt-1 text-secondary font-semibold underline cursor-pointer min-h-[32px]"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </motion.div>

      {/* Vendas de hoje: o único bloco escuro da tela */}
      <motion.div variants={rise} className="bg-ink text-canvas rounded-3xl p-4">
        <div className="flex items-center justify-between text-xs opacity-80">
          <span className="flex items-center gap-1">
            <Receipt size={14} /> Vendas hoje
          </span>
          <span className="flex items-center gap-1">
            <Hamburger size={14} /> {dados ? `${dados.kpis.totalVendasQtd} pedidos` : '—'}
          </span>
        </div>
        <p className="text-3xl font-bold mt-0.5 mb-2.5">
          {dados ? <AnimatedNumber value={dados.kpis.totalVendasValor} format={formatarMoeda} /> : '—'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl px-3 py-2 bg-muted/20">
            <p className="text-[11px] opacity-75">Compras</p>
            <p className="font-bold">{dados ? formatarMoeda(dados.kpis.totalComprasValor) : '—'}</p>
          </div>
          <div className="rounded-2xl px-3 py-2 bg-muted/20">
            <p className="text-[11px] opacity-75">Perdas</p>
            <p className="font-bold">{dados ? formatarMoeda(dados.kpis.totalPerdasValor) : '—'}</p>
          </div>
        </div>
      </motion.div>

      {/* Duas ações do dia a dia */}
      <motion.div variants={rise} className="grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          whileTap={tap}
          onClick={() => onNavegar('perdas')}
          className="bg-primary text-on-primary rounded-3xl p-3 text-left cursor-pointer min-h-[96px] flex flex-col justify-between"
        >
          <Scales size={28} weight="duotone" />
          <span>
            <span className="block font-bold">Registrar perda</span>
            <span className="block text-[11px] opacity-75">Baixa com 1 toque</span>
          </span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={tap}
          onClick={onAbrirImportarNota}
          className="bg-secondary text-on-secondary rounded-3xl p-3 text-left cursor-pointer min-h-[96px] flex flex-col justify-between"
        >
          <QrCode size={28} weight="duotone" />
          <span>
            <span className="block font-bold">Ler QR code</span>
            <span className="block text-[11px] opacity-80">Importar NF</span>
          </span>
        </motion.button>
      </motion.div>

      {/* Pedem atenção */}
      {dados && alertas.length > 0 && (
        <motion.section variants={rise} className="bg-card border border-line rounded-3xl px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold flex items-center gap-1.5">
              <Warning size={18} weight="fill" className="text-danger" /> Pedem atenção
            </h2>
            <button
              type="button"
              onClick={() => onNavegar('estoque')}
              className="text-xs font-semibold text-secondary flex items-center gap-0.5 cursor-pointer min-h-[44px]"
            >
              Ver estoque <CaretRight size={12} weight="bold" />
            </button>
          </div>
          {alertas.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-2 border-t border-line">
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  item.vencido ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-brand'
                }`}
              >
                {item.vencido ? <Thermometer size={16} /> : <TrendDown size={16} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-2 break-words">{item.nome}</p>
                <p className={`text-[11px] ${item.vencido ? 'text-danger' : 'text-muted'}`}>
                  {item.vencido
                    ? 'Vencido'
                    : `${formatarQuantidade(item.estoqueAtual, item.unidade)} · mín. ${formatarQuantidade(item.estoqueMinimo, item.unidade)}`}
                </p>
              </div>
              <motion.button
                type="button"
                whileTap={tap}
                onClick={() => (item.vencido ? onNavegar('perdas') : onAbrirImportarNota())}
                className={`shrink-0 text-[11px] font-semibold px-2.5 rounded-full min-h-[32px] cursor-pointer ${
                  item.vencido ? 'bg-danger-soft text-danger' : 'bg-secondary-soft text-secondary'
                }`}
              >
                {item.vencido ? 'Registrar perda' : 'Comprar'}
              </motion.button>
            </div>
          ))}
        </motion.section>
      )}

      {dados && alertas.length === 0 && (
        <motion.div
          variants={rise}
          className="bg-success-soft text-success rounded-3xl px-4 py-3 flex items-center gap-2.5 text-sm"
        >
          <CheckCircle size={22} weight="fill" /> Nenhum insumo abaixo do mínimo ou vencido.
        </motion.div>
      )}

      {/* Mais vendidos hoje */}
      {dados && maisVendidos.length > 0 && (
        <motion.section variants={rise} className="bg-card border border-line rounded-3xl px-4 py-3">
          <h2 className="font-semibold flex items-center gap-1.5 mb-1">
            <Hamburger size={18} weight="duotone" className="text-brand" /> Mais vendidos hoje
          </h2>
          {maisVendidos.map((item, i) => (
            <div key={item.produtoNome} className="flex items-center gap-2 py-1">
              <span className="w-4 text-xs text-muted">{i + 1}</span>
              <span className="flex-1 min-w-0 text-sm truncate">{item.produtoNome}</span>
              <div className="w-24 h-1.5 rounded-full bg-card-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.quantidadeVendida / maiorVenda) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs text-muted">{item.quantidadeVendida}</span>
            </div>
          ))}
        </motion.section>
      )}
    </motion.div>
  );
}
