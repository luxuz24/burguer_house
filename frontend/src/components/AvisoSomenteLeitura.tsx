import { Lock } from './ui/icons';

/** Aviso curto e neutro para quem não pode alterar nada (um por tela, no máximo). */
export default function AvisoSomenteLeitura({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`bg-card-2 border border-line rounded-2xl px-3 py-2 text-xs text-muted flex items-center gap-2 ${className}`}
    >
      <Lock size={14} className="shrink-0" aria-hidden="true" />
      <span>Somente leitura: alterações são feitas pelo administrador.</span>
    </p>
  );
}
