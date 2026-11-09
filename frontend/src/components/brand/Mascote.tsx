import React from 'react';
import { motion, useReducedMotion, type TargetAndTransition } from 'motion/react';

export type MascoteMood = 'idle' | 'happy' | 'thinking' | 'alert' | 'wave' | 'celebrate';

export interface MascoteProps {
  readonly mood?: MascoteMood;
  readonly size?: number;
  /** Flutuar e animar continuamente (desligado em ícones pequenos). */
  readonly animated?: boolean;
  readonly className?: string;
  readonly title?: string;
}

export const bodyMotions: Record<MascoteMood, TargetAndTransition> = {
  idle: { y: [0, -5, 0], transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } },
  happy: { y: [0, -14, 0], transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } },
  thinking: { y: [0, -4, 0], rotate: [0, -3, 0], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
  alert: { x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.6, repeat: Infinity, repeatDelay: 1.4 } },
  wave: { y: [0, -4, 0], rotate: [0, 3, 0], transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } },
  celebrate: { y: [0, -14, 0], transition: { duration: 1.2, repeat: Infinity, ease: 'easeOut' } },
};

export interface AnimacoesHumor {
  corpo?: TargetAndTransition;
  olhos?: TargetAndTransition;
  braco?: TargetAndTransition;
  pao?: TargetAndTransition;
}

/**
 * Função pura que calcula as animações aplicáveis para cada humor e estado de movimento.
 */
export function animacoesDoHumor(mood: MascoteMood, live: boolean): AnimacoesHumor {
  const feliz = mood === 'happy' || mood === 'celebrate';

  return {
    corpo: live ? bodyMotions[mood] : undefined,
    olhos: live && !feliz
      ? { scaleY: [1, 1, 0.1, 1], transition: { duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity } }
      : undefined,
    braco: live && mood === 'wave'
      ? { rotate: [0, -14, 0] }
      : undefined,
    pao: live && mood === 'celebrate'
      ? { y: [0, -16, 0], rotate: [0, -8, 0], transition: { duration: 1.2, repeat: Infinity, ease: 'easeOut' as const } }
      : undefined,
  };
}

/**
 * Mascote oficial do Burguer House (SVG puro + Motion).
 * Suporta os 6 humores da referência visual e respeita useReducedMotion().
 */
export const Mascote: React.FC<MascoteProps> = ({
  mood = 'idle',
  size = 120,
  animated = true,
  className,
  title = 'Mascote do Burguer House',
}) => {
  const reduce = useReducedMotion();
  const live = animated && !reduce;
  const animacoes = animacoesDoHumor(mood, live);

  const feliz = mood === 'happy' || mood === 'celebrate';
  const center = { transformBox: 'fill-box' as const, transformOrigin: 'center' };

  // Braços
  const armUpR = (
    <motion.g
      animate={animacoes.braco}
      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }}
    >
      <path d="M120 108 q14 -10 16 -28" stroke="#151413" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="136" cy="78" r="7" fill="#fff" stroke="#151413" strokeWidth="3" />
    </motion.g>
  );

  const armDownR = (
    <g>
      <path d="M120 110 q12 6 14 16" stroke="#151413" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="134" cy="126" r="7" fill="#fff" stroke="#151413" strokeWidth="3" />
    </g>
  );

  const armUpL = (
    <g>
      <path d="M40 108 q-14 -10 -16 -28" stroke="#151413" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="78" r="7" fill="#fff" stroke="#151413" strokeWidth="3" />
    </g>
  );

  const armDownL = (
    <g>
      <path d="M40 110 q-12 6 -14 16" stroke="#151413" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="126" r="7" fill="#fff" stroke="#151413" strokeWidth="3" />
    </g>
  );

  const armR = (mood === 'wave' || mood === 'celebrate' || mood === 'happy') ? armUpR : armDownR;
  const armL = mood === 'celebrate' ? armUpL : armDownL;

  return (
    <motion.svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={`shrink-0 ${className ?? ''}`}
      animate={animacoes.corpo}
      data-animated={live}
      style={{ overflow: 'visible' }}
    >
      {/* Sombra no chão */}
      <motion.ellipse
        cx="80"
        cy="152"
        rx="40"
        ry="5"
        fill="#151413"
        opacity="0.12"
        animate={live ? { scaleX: [1, 0.88, 1], opacity: [0.12, 0.08, 0.12] } : undefined}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={center}
      />

      {/* Braços atrás do corpo */}
      {armL}
      {armR}

      {/* Pão de baixo */}
      <rect x="36" y="118" width="88" height="20" rx="10" fill="#E9A057" />

      {/* Carne (hambúrguer) */}
      <rect x="34" y="104" width="92" height="17" rx="8" fill="#5A3220" />

      {/* Queijo derretido */}
      <path
        d="M36 104 h88 l-6 9 l-6 -5 l-8 11 l-8 -9 l-10 7 l-8 -8 l-10 10 l-8 -9 l-8 6 l-7 -8 l-9 6z"
        fill="#FFC531"
      />

      {/* Alface ondulada */}
      <path
        d="M33 101 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 q8 -8 16 0 v5 h-96z"
        fill="#4CAF50"
      />

      {/* Pão de cima + Rosto + Boné */}
      <motion.g animate={animacoes.pao} style={center}>
        {/* Pão superior */}
        <path d="M30 100 q0 -62 50 -62 q50 0 50 62 z" fill="#FF7A1A" />

        {/* Boné azul */}
        <path d="M44 46 q20 -22 52 -14 l4 -12 q-36 -10 -60 14 z" fill="#1D4ED8" />
        <path d="M96 32 q16 2 24 10" stroke="#1D4ED8" strokeWidth="5" strokeLinecap="round" fill="none" />

        {/* Gergelins no pão */}
        <ellipse cx="56" cy="56" rx="3" ry="1.8" fill="#FFF9F3" transform="rotate(-20 56 56)" />
        <ellipse cx="108" cy="54" rx="3" ry="1.8" fill="#FFF9F3" transform="rotate(25 108 54)" />
        <ellipse cx="80" cy="50" rx="3" ry="1.8" fill="#FFF9F3" />
        <ellipse cx="46" cy="78" rx="3" ry="1.8" fill="#FFF9F3" />
        <ellipse cx="116" cy="80" rx="3" ry="1.8" fill="#FFF9F3" />

        {/* Olhos */}
        {feliz ? (
          <path
            d="M60 70 q7 -8 14 0 M86 70 q7 -8 14 0"
            stroke="#151413"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <motion.g animate={animacoes.olhos} style={center}>
            <ellipse cx="67" cy="70" rx="5.5" ry="7" fill="#151413" />
            <ellipse cx="93" cy="70" rx="5.5" ry="7" fill="#151413" />
            <circle cx="69" cy="67" r="2" fill="#fff" />
            <circle cx="95" cy="67" r="2" fill="#fff" />
          </motion.g>
        )}

        {/* Sobrancelhas no alerta */}
        {mood === 'alert' && (
          <path d="M59 58 l14 4 M101 58 l-14 4" stroke="#151413" strokeWidth="3.5" strokeLinecap="round" />
        )}

        {/* Bochechas rosadas */}
        <ellipse cx="56" cy="82" rx="6" ry="3.5" fill="#FF4D2E" opacity="0.45" />
        <ellipse cx="104" cy="82" rx="6" ry="3.5" fill="#FF4D2E" opacity="0.45" />

        {/* Boca */}
        {mood === 'alert' ? (
          <path d="M72 86 q8 -6 16 0" stroke="#151413" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : mood === 'idle' || mood === 'thinking' ? (
          <path d="M70 82 q10 9 20 0" stroke="#151413" strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : (
          <g>
            <path d="M68 80 q12 16 24 0 z" fill="#151413" />
            <path d="M74 87 q6 4 12 0" fill="#FF6B4A" />
          </g>
        )}

        {/* Gota de suor no alerta */}
        {mood === 'alert' && (
          <path d="M112 52 q5 9 0 13 q-5 -4 0 -13z" fill="#7AA7FF" />
        )}
      </motion.g>

      {/* Balões de pensamento no thinking */}
      {mood === 'thinking' && (
        <g>
          <circle cx="128" cy="40" r="4" fill="#B5AEA4" />
          <circle cx="138" cy="28" r="6" fill="#B5AEA4" />
        </g>
      )}

      {/* Confetes na celebração */}
      {mood === 'celebrate' && (
        <g>
          <rect x="22" y="30" width="7" height="7" fill="#1D4ED8" transform="rotate(20 25 33)" />
          <rect x="132" y="38" width="7" height="7" fill="#FF7A1A" transform="rotate(-15 135 41)" />
          <circle cx="34" cy="62" r="3.5" fill="#FF7A1A" />
          <circle cx="128" cy="20" r="3.5" fill="#1D4ED8" />
        </g>
      )}
    </motion.svg>
  );
};

export default Mascote;
