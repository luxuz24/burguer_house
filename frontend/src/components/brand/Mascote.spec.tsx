import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Mascote, { animacoesDoHumor, type MascoteMood } from './Mascote';

const mockReducedMotion = vi.fn(() => false);

vi.mock('motion/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('motion/react')>();
  return {
    ...mod,
    useReducedMotion: () => mockReducedMotion(),
  };
});

describe('Brand Component — Mascote (Burguer House)', () => {
  const humores: MascoteMood[] = ['idle', 'happy', 'thinking', 'alert', 'wave', 'celebrate'];

  beforeEach(() => {
    mockReducedMotion.mockReturnValue(false);
  });

  for (const mood of humores) {
    it(`renderiza com sucesso o humor "${mood}" com role="img" e aria-label`, () => {
      render(<Mascote mood={mood} title={`Mascote humor ${mood}`} />);

      const el = screen.getByRole('img');
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute('aria-label', `Mascote humor ${mood}`);
    });
  }

  it('renderiza balões de pensamento no humor thinking', () => {
    const { container } = render(<Mascote mood="thinking" />);
    // Balões de pensamento no thinking (raios 4 e 6 com preenchimento #B5AEA4)
    const circles = container.querySelectorAll('circle[fill="#B5AEA4"]');
    expect(circles.length).toBe(2);
  });

  it('renderiza gota de suor e sobrancelhas no humor alert', () => {
    const { container } = render(<Mascote mood="alert" />);
    // Gota de suor azul no alerta
    const sweat = container.querySelector('path[fill="#7AA7FF"]');
    expect(sweat).toBeInTheDocument();
  });

  it('renderiza confetes no humor celebrate', () => {
    const { container } = render(<Mascote mood="celebrate" />);
    const confetesRect = container.querySelectorAll('rect[width="7"][height="7"]');
    expect(confetesRect.length).toBe(2);
  });

  it('desativa animações quando animated={false}', () => {
    const { container } = render(<Mascote mood="celebrate" animated={false} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-animated', 'false');
  });

  it('respeita "reduzir movimento" desligando as animações ativas', () => {
    mockReducedMotion.mockReturnValue(true);
    const { container } = render(<Mascote mood="celebrate" animated={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-animated', 'false');
  });

  describe('Função pura animacoesDoHumor', () => {
    it('com live=false, todas as animações são undefined em todos os 6 humores', () => {
      for (const mood of humores) {
        const animacoes = animacoesDoHumor(mood, false);
        expect(animacoes.corpo).toBeUndefined();
        expect(animacoes.olhos).toBeUndefined();
        expect(animacoes.braco).toBeUndefined();
        expect(animacoes.pao).toBeUndefined();
      }
    });

    it('com live=true, o humor celebrate tem animação do pão', () => {
      const animacoes = animacoesDoHumor('celebrate', true);
      expect(animacoes.pao).toBeDefined();
      expect(animacoes.pao).toHaveProperty('y');
    });
  });
});
