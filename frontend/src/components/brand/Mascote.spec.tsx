import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Mascote, { type MascoteMood } from './Mascote';

describe('Brand Component — Mascote (Burguer House)', () => {
  const humores: MascoteMood[] = ['idle', 'happy', 'thinking', 'alert', 'wave', 'celebrate'];

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
    const { container } = render(<Mascote mood="idle" animated={false} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('respeita "reduzir movimento" desligando as animações ativas', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<Mascote mood="celebrate" animated={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    window.matchMedia = originalMatchMedia;
  });
});
