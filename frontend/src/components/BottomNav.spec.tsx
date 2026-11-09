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

  it('alterna o preenchimento dos ícones ao trocar de aba (preenchido vs none)', () => {
    const { container, rerender } = render(<BottomNav activeTab="inicio" setActiveTab={vi.fn()} />);

    const svgs = () => container.querySelectorAll('nav svg');

    // Na aba ativa 'inicio': o primeiro path tem fill diferente de 'none'
    const primeiroPathInicio = svgs()[0].querySelector('path');
    expect(primeiroPathInicio?.getAttribute('fill')).not.toBe('none');
    expect(primeiroPathInicio?.getAttribute('fill')).toBeTruthy();

    // Na aba inativa 'perdas': o primeiro path tem fill="none"
    const primeiroPathPerdas = svgs()[2].querySelector('path');
    expect(primeiroPathPerdas?.getAttribute('fill')).toBe('none');

    // Troca a aba para 'perdas'
    rerender(<BottomNav activeTab="perdas" setActiveTab={vi.fn()} />);

    // Os preenchimentos se invertem: 'inicio' fica com fill="none" e 'perdas' com fill diferente de 'none'
    const primeiroPathInicioNovo = svgs()[0].querySelector('path');
    expect(primeiroPathInicioNovo?.getAttribute('fill')).toBe('none');

    const primeiroPathPerdasNovo = svgs()[2].querySelector('path');
    expect(primeiroPathPerdasNovo?.getAttribute('fill')).not.toBe('none');
    expect(primeiroPathPerdasNovo?.getAttribute('fill')).toBeTruthy();
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
