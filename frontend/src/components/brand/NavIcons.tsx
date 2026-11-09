import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const COR_QUEIJO = '#FFC531';
export const COR_CARNE = '#5A3220';
export const COR_ALFACE = '#4CAF50';
export const COR_PAO_BAIXO = '#E9A057';
export const COR_BORDA_ATIVA = '#151413';

export type NavTabId = 'inicio' | 'estoque' | 'perdas' | 'relatorios';

interface NavIconProps {
  readonly ativo?: boolean;
  readonly size?: number;
  readonly className?: string;
}

/**
 * Ícone da aba Início (Hambúrguer completo: pão, alface, queijo, carne, pão de baixo).
 */
export const NavIconInicio: React.FC<NavIconProps> = ({ ativo = false, size = 28, className }) => {
  const stroke = ativo ? COR_BORDA_ATIVA : 'var(--color-muted)';
  const strokeWidth = ativo ? 1.9 : 1.7;
  const f = (cor: string) => (ativo ? cor : 'none');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      <path d="M6 15 C6 8.5 10.5 5 16 5 C21.5 5 26 8.5 26 15 Z" fill={f('var(--color-primary)')} />
      {ativo && (
        <>
          <ellipse cx="12" cy="9.5" rx="1" ry="0.6" fill="#FFF9F3" stroke="none" />
          <ellipse cx="17" cy="8" rx="1" ry="0.6" fill="#FFF9F3" stroke="none" />
          <ellipse cx="20.5" cy="11" rx="1" ry="0.6" fill="#FFF9F3" stroke="none" />
        </>
      )}
      <path
        d="M5 18 q2.75 -2.2 5.5 0 t5.5 0 t5.5 0 t5.5 0"
        fill="none"
        stroke={ativo ? COR_ALFACE : stroke}
      />
      <path
        d="M5.5 19.5 h21 l-3 3 l-3 -2 l-4 3 l-4 -3 l-3 2 z"
        fill={f(COR_QUEIJO)}
        stroke={ativo ? COR_BORDA_ATIVA : 'none'}
        strokeWidth={1.2}
      />
      <rect x="5" y="19.5" width="22" height="4" rx="2" fill={f(COR_CARNE)} />
      <rect x="6" y="24.5" width="20" height="3.8" rx="1.9" fill={f(COR_PAO_BAIXO)} />
    </svg>
  );
};

/**
 * Ícone da aba Estoque (Geladeira com queijo e molho/tomate).
 */
export const NavIconEstoque: React.FC<NavIconProps> = ({ ativo = false, size = 28, className }) => {
  const stroke = ativo ? COR_BORDA_ATIVA : 'var(--color-muted)';
  const strokeWidth = ativo ? 1.9 : 1.7;
  const f = (cor: string) => (ativo ? cor : 'none');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      <rect x="8" y="3.5" width="16" height="25" rx="3.5" fill={f('var(--color-secondary)')} />
      <path d="M8 12.5 h16" fill="none" />
      <path d="M11.5 6.5 v3 M11.5 16 v5" stroke={ativo ? '#FFFFFF' : stroke} strokeWidth={2.2} />
      {ativo && (
        <>
          <circle cx="19.5" cy="8" r="1.6" fill={COR_QUEIJO} stroke={COR_BORDA_ATIVA} strokeWidth={1} />
          <rect x="16.5" y="18" width="5" height="3.2" rx="1" fill="var(--color-primary)" stroke={COR_BORDA_ATIVA} strokeWidth={1} />
        </>
      )}
      <path d="M10 28.5 v1.5 M22 28.5 v1.5" fill="none" />
    </svg>
  );
};

/**
 * Ícone da aba Perdas (Lixeira com pão mordido caindo).
 */
export const NavIconPerdas: React.FC<NavIconProps> = ({ ativo = false, size = 28, className }) => {
  const stroke = ativo ? COR_BORDA_ATIVA : 'var(--color-muted)';
  const strokeWidth = ativo ? 1.9 : 1.7;
  const f = (cor: string) => (ativo ? cor : 'none');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      <path d="M10.5 10 q5.5 -8 11 0" fill={f('var(--color-primary)')} />
      {ativo && (
        <path d="M18.2 4.6 q1.2 1.4 2.6 1.2 q0.2 1.6 1.6 2.4" fill="none" stroke={COR_BORDA_ATIVA} strokeWidth={1.4} />
      )}
      <path d="M5.5 11.5 L26 9.2" fill="none" strokeWidth={strokeWidth + 0.3} />
      <path d="M13.5 10.6 l-0.3 -2.2 l5 -0.6 l0.3 2.2" fill="none" />
      <path d="M8 13.5 h16 l-1.6 13.3 a2 2 0 0 1 -2 1.7 h-8.8 a2 2 0 0 1 -2 -1.7 Z" fill={f('#151413')} />
      <path d="M13 17 v8 M19 17 v8" fill="none" stroke={ativo ? '#FFF9F3' : stroke} strokeWidth={1.5} />
    </svg>
  );
};

/**
 * Ícone da aba Relatórios (Comanda picotada com gráfico de barras).
 */
export const NavIconRelatorios: React.FC<NavIconProps> = ({ ativo = false, size = 28, className }) => {
  const stroke = ativo ? COR_BORDA_ATIVA : 'var(--color-muted)';
  const strokeWidth = ativo ? 1.9 : 1.7;
  const f = (cor: string) => (ativo ? cor : 'none');

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      <path d="M8 4 h16 v23.5 l-2.7 -2 l-2.6 2 l-2.7 -2 l-2.7 2 l-2.6 -2 l-2.7 2 Z" fill={f('#FFFFFF')} />
      <path d="M11 8 h10" fill="none" stroke={ativo ? COR_BORDA_ATIVA : stroke} strokeWidth={1.5} />
      <rect x="11" y="16.5" width="2.6" height="5.5" rx="0.8" fill={f('var(--color-secondary)')} strokeWidth={1.2} />
      <rect x="14.7" y="13" width="2.6" height="9" rx="0.8" fill={f('var(--color-primary)')} strokeWidth={1.2} />
      <rect x="18.4" y="10.5" width="2.6" height="11.5" rx="0.8" fill={f('var(--color-primary)')} strokeWidth={1.2} />
    </svg>
  );
};

export interface NavIconWrapperProps {
  readonly id: NavTabId;
  readonly ativo: boolean;
  readonly size?: number;
  readonly className?: string;
}

/**
 * Invólucro de ícone de navegação com mola 'pop' ao ativar (escala 0.6 -> 1.18 -> 1).
 */
export const NavIcon: React.FC<NavIconWrapperProps> = ({ id, ativo, size = 28, className }) => {
  const reduce = useReducedMotion();

  const IconComponent = {
    inicio: NavIconInicio,
    estoque: NavIconEstoque,
    perdas: NavIconPerdas,
    relatorios: NavIconRelatorios,
  }[id];

  return (
    <motion.span
      className={`inline-grid place-items-center ${className ?? ''}`}
      animate={ativo && !reduce ? { scale: [0.6, 1.18, 1] } : { scale: 1 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <IconComponent ativo={ativo} size={size} />
    </motion.span>
  );
};

export default NavIcon;
