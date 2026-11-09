import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BottomNav from './BottomNav';

describe('Navigation — BottomNav (Barra Inferior Estilo 1 Adesivo)', () => {
  it('renderiza as quatro abas com seus rótulos', () => {
    render(<BottomNav activeTab="inicio" setActiveTab={vi.fn()} />);

    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Estoque')).toBeInTheDocument();
    expect(screen.getByText('Perdas')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('aplica aria-current="page" exclusivamente na aba ativa', () => {
    render(<BottomNav activeTab="estoque" setActiveTab={vi.fn()} />);

    const botoes = screen.getAllByRole('button');
    const botaoInicio = botoes[0];
    const botaoEstoque = botoes[1];
    const botaoPerdas = botoes[2];
    const botaoRelatorios = botoes[3];

    expect(botaoEstoque).toHaveAttribute('aria-current', 'page');
    expect(botaoInicio).not.toHaveAttribute('aria-current');
    expect(botaoPerdas).not.toHaveAttribute('aria-current');
    expect(botaoRelatorios).not.toHaveAttribute('aria-current');
  });

  it('dispara setActiveTab com o id correto ao clicar em outra aba', () => {
    const setActiveTab = vi.fn();
    render(<BottomNav activeTab="inicio" setActiveTab={setActiveTab} />);

    const botaoPerdas = screen.getByText('Perdas').closest('button');
    expect(botaoPerdas).toBeInTheDocument();

    fireEvent.click(botaoPerdas!);
    expect(setActiveTab).toHaveBeenCalledWith('perdas');
  });

  it('renderiza o ícone com preenchimento na aba ativa e contorno (none) nas inativas', () => {
    const { container } = render(<BottomNav activeTab="inicio" setActiveTab={vi.fn()} />);

    // Na aba ativa 'inicio', o pão superior é preenchido com var(--color-primary)
    const svgs = container.querySelectorAll('nav svg');
    expect(svgs.length).toBe(4);

    const svgInicio = svgs[0];
    const pathPaoAtivo = svgInicio.querySelector('path[fill="var(--color-primary)"]');
    expect(pathPaoAtivo).toBeInTheDocument();

    // Na aba inativa 'estoque', a geladeira tem fill="none"
    const svgEstoque = svgs[1];
    const rectGeladeiraInativa = svgEstoque.querySelector('rect[fill="none"]');
    expect(rectGeladeiraInativa).toBeInTheDocument();
  });

  it('garante classes de acessibilidade para alvo de toque >= 44x44 px', () => {
    render(<BottomNav activeTab="inicio" setActiveTab={vi.fn()} />);

    const botoes = screen.getAllByRole('button');
    for (const btn of botoes) {
      expect(btn.className).toContain('min-w-[64px]');
      expect(btn.className).toContain('min-h-[48px]');
    }
  });
});
