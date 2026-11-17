import { useState } from 'react';
import { CircleNotch, WarningCircle } from './ui/icons';
import EstornoFechamentoSheet from './EstornoFechamentoSheet';
import { formatarDataHora } from '../lib/formatar';
import {
  formatarHoraLoja,
  textoItensFechamento,
  type FechamentoListado,
  type ListagemFechamentos,
} from '../lib/fechamentoDia';

interface Props {
  dados: ListagemFechamentos | null;
  carregando: boolean;
  erro: string | null;
  onTentarNovamente: () => void;
  /** Chamado depois de um estorno feito por esta lista (para recarregar). */
  onAlterado: () => void;
}

function Linha({ f, onDesfazer }: { f: FechamentoListado; onDesfazer: () => void }) {
  const horario = formatarHoraLoja(f.criadoEm);
  return (
    <li
      className={`rounded-2xl border px-3 py-2 space-y-1 ${f.estornada ? 'bg-card-2 border-line opacity-70' : 'bg-card border-line'}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          <span className="font-bold text-ink">{horario}</span> · {f.usuario ? f.usuario.nome : 'Usuário removido'}
        </span>
        {f.estornada && (
          <span className="shrink-0 bg-card border border-line rounded-full px-2 py-0.5 font-bold text-secondary">Estornado</span>
        )}
      </div>
      <p className="text-sm text-ink break-words">{textoItensFechamento(f.itens)}</p>
      {f.observacao && <p className="text-xs text-muted break-words">{f.observacao}</p>}
      {f.estornada && f.estorno && (
        <p className="text-xs text-muted break-words">
          Motivo: {f.estorno.motivo}
          {f.estorno.usuario ? ` · por ${f.estorno.usuario.nome}` : ''}
          {f.estorno.em ? ` · ${formatarDataHora(f.estorno.em)}` : ''}
        </p>
      )}
      {!f.estornada && (
        <button
          type="button"
          onClick={onDesfazer}
          aria-label={`Desfazer lançamento das ${horario}${f.usuario ? ` de ${f.usuario.nome}` : ''}`}
          className="min-h-[44px] px-3 rounded-xl bg-field text-ink text-xs font-bold cursor-pointer"
        >
          Desfazer
        </button>
      )}
    </li>
  );
}

/** Lista dos fechamentos manuais de um dia, com o estorno pelo mesmo Sheet da tela de confirmação. */
export default function FechamentosDoDia({ dados, carregando, erro, onTentarNovamente, onAlterado }: Props) {
  const [estornandoId, setEstornandoId] = useState<string | null>(null);

  return (
    <section aria-label="Lançamentos do dia" className="space-y-2">
      <h2 className="text-sm font-bold text-ink">Lançamentos do dia</h2>

      {erro && (
        <div role="alert" className="bg-danger-soft border border-danger/40 text-danger p-3 rounded-xl text-xs flex gap-2 items-center">
          <WarningCircle size={18} className="shrink-0" />
          <p className="flex-1 font-semibold">{erro}</p>
          <button
            type="button"
            onClick={onTentarNovamente}
            className="shrink-0 min-h-[44px] px-3 rounded-xl bg-card border border-line text-ink font-bold cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {carregando && !erro && (
        <p className="text-xs text-muted flex items-center gap-2">
          <CircleNotch size={14} className="animate-spin" /> Carregando lançamentos…
        </p>
      )}

      {!carregando && !erro && dados && dados.fechamentos.length === 0 && (
        <p className="text-xs text-muted">Nenhum fechamento lançado neste dia.</p>
      )}

      {dados && dados.fechamentos.length > 0 && (
        <ul className="space-y-2">
          {dados.fechamentos.map((f) => (
            <Linha key={f.id} f={f} onDesfazer={() => setEstornandoId(f.id)} />
          ))}
        </ul>
      )}

      {estornandoId && (
        <EstornoFechamentoSheet
          aberto
          vendaId={estornandoId}
          onFechar={() => setEstornandoId(null)}
          onEstornado={onAlterado}
          onJaEstornado={onAlterado}
        />
      )}
    </section>
  );
}
