import type { Icon } from './ui/icons';
import Mascote from './brand/Mascote';

interface Props {
  icone?: Icon;
  titulo: string;
  descricao?: string;
  acao?: { texto: string; onClick: () => void };
}

/** Placeholder amigável para listas sem dados com o Mascote pensando. */
export default function EstadoVazio({ titulo, descricao, acao }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-6 rounded-3xl border border-dashed border-line bg-card/60">
      <Mascote mood="thinking" size={96} className="mb-2" />
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      {descricao && (
        <p className="text-xs text-muted mt-1 max-w-xs leading-relaxed">{descricao}</p>
      )}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="mt-4 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold transition hover:bg-primary-deep active:scale-95 cursor-pointer shadow-sm"
        >
          {acao.texto}
        </button>
      )}
    </div>
  );
}
