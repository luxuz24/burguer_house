import { Warning, CheckCircle } from './ui/icons';
import { formatarQuantidade } from '../lib/formatar';
import { formatarDiaCurto, type ResultadoConfirmacao, type ResultadoEstorno } from '../lib/fechamentoDia';

interface Props {
  resultado: ResultadoConfirmacao;
  /** Presente quando o estorno foi feito nesta tela (traz as devoluções). */
  estorno: ResultadoEstorno | null;
  /** O backend respondeu que o fechamento já estava estornado (sem detalhes das devoluções). */
  jaEstornado: boolean;
  onDesfazer: () => void;
  onConcluir: () => void;
}

/** Tela de resultado do fechamento: baixa registrada, ou estornada depois de desfeita. */
export default function FechamentoConcluido({ resultado, estorno, jaEstornado, onDesfazer, onConcluir }: Props) {
  const estornado = estorno !== null || jaEstornado;

  return (
    <div className="flex flex-col min-h-full pb-28 bg-canvas text-ink">
      <div className="px-4 pt-4 pb-2 space-y-1">
        <h1 className="text-xl font-bold leading-tight flex items-center gap-2">
          <CheckCircle size={24} weight="fill" className={estornado ? 'text-muted' : 'text-success'} />
          {estornado ? 'Fechamento estornado' : 'Baixa registrada'}
        </h1>
        <p className="text-xs text-muted">Dia {formatarDiaCurto(resultado.data)}</p>
        {estornado && (
          <span className="inline-block bg-card-2 border border-line rounded-full px-3 py-1 text-xs font-bold text-secondary">
            Estornado
          </span>
        )}
      </div>

      <div className="px-4 pt-2 space-y-4">
        {resultado.reaproveitado && (
          <p role="status" className="bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs font-semibold text-secondary">
            Este fechamento já tinha sido registrado.
          </p>
        )}

        <section className="space-y-1.5" aria-label="Itens do fechamento">
          <h2 className="text-sm font-bold text-ink">Itens do dia</h2>
          <ul className="space-y-1.5">
            {resultado.itens.map((i) => (
              <li key={i.produtoId} className="bg-card border border-line rounded-2xl px-3 py-2 text-sm flex justify-between gap-2">
                <span className="min-w-0 break-words">{i.nome}</span>
                <span className="font-bold shrink-0">× {formatarQuantidade(i.quantidade)}</span>
              </li>
            ))}
          </ul>
        </section>

        {!estornado && resultado.insumosComEstoqueNegativo.length > 0 && (
          <section className="space-y-1.5" aria-label="Insumos negativos">
            <h2 className="text-sm font-bold text-danger flex items-center gap-1">
              <Warning size={16} weight="fill" /> Ficaram negativos
            </h2>
            <ul className="space-y-1.5">
              {resultado.insumosComEstoqueNegativo.map((i) => (
                <li key={i.id} className="bg-danger-soft border border-danger/40 rounded-2xl px-3 py-2 text-xs">
                  <span className="font-semibold text-ink">{i.nome}</span>
                  <span className="text-danger font-bold"> · estoque {formatarQuantidade(i.estoqueAtual)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!estornado && (
          <section className="space-y-1.5" aria-label="Estoque baixado">
            <h2 className="text-sm font-bold text-ink">Baixado do estoque</h2>
            <ul className="space-y-1.5">
              {resultado.consumos.map((c) => (
                <li key={c.insumoId} className="bg-card border border-line rounded-2xl px-3 py-2 text-xs flex justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold text-ink">{c.nome}</span>
                  <span className="text-muted shrink-0">−{formatarQuantidade(c.quantidade, c.unidade)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {estornado && (
          <section className="space-y-1.5" aria-label="Estoque devolvido">
            <h2 className="text-sm font-bold text-ink">Devolvido ao estoque</h2>
            {estorno ? (
              <ul className="space-y-1.5">
                {estorno.devolucoes.map((d) => (
                  <li key={d.insumoId} className="bg-card border border-line rounded-2xl px-3 py-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="min-w-0 break-words font-semibold text-ink">{d.nome}</span>
                      <span className="text-muted shrink-0">+{formatarQuantidade(d.quantidade, d.unidade)}</span>
                    </div>
                    <p className="text-muted mt-0.5">estoque agora {formatarQuantidade(d.estoqueAtual, d.unidade)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">O estoque deste fechamento já foi devolvido; veja o motivo na lista do dia.</p>
            )}
          </section>
        )}
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-canvas border-t border-line px-4 py-3 flex gap-2 z-20">
        {!estornado && (
          <button
            type="button"
            onClick={onDesfazer}
            className="flex-1 bg-card border border-line text-ink rounded-2xl min-h-[50px] font-bold cursor-pointer"
          >
            Desfazer
          </button>
        )}
        <button
          type="button"
          onClick={onConcluir}
          className="flex-1 bg-primary text-on-primary rounded-2xl min-h-[50px] font-bold cursor-pointer"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
