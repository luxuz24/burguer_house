import type { LucideIcon } from 'lucide-react';

interface Props {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: { texto: string; onClick: () => void };
}

/** Placeholder amigável para listas sem dados (em vez de uma tela em branco). */
export default function EstadoVazio({ icone: Icone, titulo, descricao, acao }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <Icone size={22} className="text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{titulo}</p>
      {descricao && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">{descricao}</p>
      )}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          {acao.texto}
        </button>
      )}
    </div>
  );
}
